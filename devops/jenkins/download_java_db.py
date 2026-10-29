"""Resume the official GHCR Java DB OCI blob and verify its manifest SHA-256.

Some networks interrupt this ~1 GiB download. Never substitute an unverified DB
or disable Java analysis. Public-registry bearer tokens stay in memory.
"""
import hashlib
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from http.client import HTTPException


def download_blob(blob_url, headers, archive, expected):
    """Bounded parallel HTTP ranges; partial chunks survive interrupted runs."""
    chunk_size = 16 * 1024 * 1024
    parts = archive.with_suffix('.parts')
    parts.mkdir(exist_ok=True)
    count = (expected + chunk_size - 1) // chunk_size
    # Reuse any bytes fetched by an earlier single-stream attempt.
    if archive.exists() and archive.stat().st_size < expected:
        with archive.open('rb') as previous:
            for index in range(count):
                data = previous.read(chunk_size)
                if not data:
                    break
                part = parts / str(index)
                if not part.exists() or part.stat().st_size < len(data):
                    part.write_bytes(data)
    deadline = time.monotonic() + 30 * 60

    def fetch(index):
        start = index * chunk_size
        size = min(chunk_size, expected - start)
        part = parts / str(index)
        http = urllib.request.build_opener(SafeRedirect())
        for attempt in range(1, 11):
            offset = part.stat().st_size if part.exists() else 0
            if offset == size:
                return
            assert offset < size, 'Cached chunk exceeds expected size'
            if time.monotonic() >= deadline:
                raise RuntimeError('Java DB download exceeded 30 minutes')
            first, last = start + offset, start + size - 1
            request = urllib.request.Request(blob_url, headers={**headers, 'Range': f'bytes={first}-{last}'})
            try:
                with http.open(request, timeout=45) as response:
                    if response.status != 206 or response.headers.get('Content-Range') != f'bytes {first}-{last}/{expected}':
                        raise RuntimeError('Registry did not honor the requested byte range')
                    with part.open('ab') as target:
                        while chunk := response.read(1024 * 1024):
                            target.write(chunk)
                            if target.tell() > size or time.monotonic() >= deadline:
                                raise RuntimeError('Transfer exceeded its size/time limit')
            except (OSError, urllib.error.URLError, HTTPException):
                # Never print token-bearing redirect URLs from exception strings.
                print(f'Java DB chunk {index + 1}: interrupted, retry {attempt}/10', flush=True)
            if part.exists() and part.stat().st_size == size:
                print(f'Java DB chunk {index + 1}/{count} complete', flush=True)
                return
            time.sleep(3)
        raise RuntimeError('Java DB chunk download incomplete')

    if not archive.exists() or archive.stat().st_size != expected:
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            list(pool.map(fetch, range(count)))
        with archive.open('wb') as combined:
            for index in range(count):
                with (parts / str(index)).open('rb') as part:
                    shutil.copyfileobj(part, combined)
    return parts


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if urllib.parse.urlsplit(req.full_url).netloc != urllib.parse.urlsplit(newurl).netloc:
            redirected.remove_header('Authorization')
        return redirected


def main():
    registry = 'https://ghcr.io'
    repository = 'aquasecurity/trivy-java-db'
    http = urllib.request.build_opener(SafeRedirect())
    token_url = registry + '/token?' + urllib.parse.urlencode({'scope': f'repository:{repository}:pull', 'service': 'ghcr.io'})
    with http.open(token_url, timeout=45) as response:
        token = json.load(response)['token']
    headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.oci.image.manifest.v1+json'}
    request = urllib.request.Request(f'{registry}/v2/{repository}/manifests/1', headers=headers)
    with http.open(request, timeout=45) as response:
        manifest = json.load(response)
    layers = manifest['layers']
    assert len(layers) == 1, 'Expected one official Java DB layer'
    layer = layers[0]
    algorithm, digest = layer['digest'].split(':', 1)
    assert algorithm == 'sha256' and len(digest) == 64 and all(c in '0123456789abcdef' for c in digest)
    expected = layer['size']
    assert 0 < expected < 4 * 1024 ** 3, 'Unexpected Java DB layer size'
    cache = Path(os.environ['TRIVY_CACHE_DIR']) / 'java-db'
    cache.mkdir(parents=True, exist_ok=True)
    stamp = cache / 'verified-oci-digest.txt'
    if stamp.exists() and stamp.read_text() == digest and (cache / 'metadata.json').exists() and (cache / 'trivy-java.db').exists() and (cache / 'trivy-java.db').stat().st_size > 0:
        print('Official Java DB is current; verified OCI digest', digest, flush=True)
        return
    archive = cache / (digest + '.tar.gz.part')
    blob_url = f'{registry}/v2/{repository}/blobs/{layer["digest"]}'
    print(f'Fetching official Java DB: {expected} bytes, digest {digest}', flush=True)
    parts = download_blob(blob_url, headers, archive, expected)
    assert archive.exists() and archive.stat().st_size == expected, 'Java DB download incomplete'
    with archive.open('rb') as data:
        actual = hashlib.file_digest(data, 'sha256').hexdigest()
    assert actual == digest, 'Java DB digest mismatch; refusing to use it'
    with tempfile.TemporaryDirectory(prefix='verified-', dir=cache) as staging:
        staging = Path(staging)
        with tarfile.open(archive, 'r:gz') as source:
            for name in ('trivy-java.db', 'metadata.json'):
                member = source.getmember(name)
                assert member.isfile(), 'Database archive member must be a regular file'
                with source.extractfile(member) as incoming, (staging / name).open('wb') as outgoing:
                    shutil.copyfileobj(incoming, outgoing)
        metadata = json.loads((staging / 'metadata.json').read_text())
        assert metadata['Version'] == 1, 'Unexpected Java DB schema'
        os.replace(staging / 'trivy-java.db', cache / 'trivy-java.db')
        os.replace(staging / 'metadata.json', cache / 'metadata.json')
        stamp.write_text(digest)
    archive.unlink()
    for part in parts.iterdir():
        part.unlink()
    parts.rmdir()
    print('Installed official Java DB after SHA-256 verification:', digest, flush=True)


if __name__ == '__main__':
    try:
        # The CI agent runs Linux. Prevent two builds/helpers from updating the
        # shared database cache simultaneously; the lock releases on process exit.
        import fcntl
        cache_root = Path(os.environ['TRIVY_CACHE_DIR'])
        cache_root.mkdir(parents=True, exist_ok=True)
        with (cache_root / '.java-db-download.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            main()
    except Exception as error:
        # Exception type is enough for diagnostics; never print token-bearing URLs.
        raise SystemExit('Java DB preparation failed (' + type(error).__name__ + '). Scanning must not continue.')
