import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.request
from download_java_db import SafeRedirect, download_blob, main


class Reply(io.BytesIO):
    def __init__(self, content, status=200, headers=None):
        super().__init__(content)
        self.status, self.headers = status, headers or {}


class DownloadTest(unittest.TestCase):
    def test_resume_fetches_only_remaining_bytes(self):
        data = b'abcdef' * 10000
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'blob.part'
            archive.write_bytes(data[:100])
            class Registry:
                def open(self, request, timeout):
                    self_range = request.get_header('Range')
                    if self_range != f'bytes=100-{len(data)-1}':
                        raise AssertionError(self_range)
                    return Reply(data[100:], 206, {'Content-Range': f'bytes 100-{len(data)-1}/{len(data)}'})
            with patch('download_java_db.urllib.request.build_opener', return_value=Registry()):
                download_blob('https://example.test/blob', {}, archive, len(data))
            self.assertEqual(archive.read_bytes(), data)

    def test_ignored_range_fails_instead_of_corrupting_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            class Registry:
                def open(self, request, timeout):
                    return Reply(b'abcdef')
            with patch('download_java_db.urllib.request.build_opener', return_value=Registry()):
                with self.assertRaisesRegex(RuntimeError, 'byte range'):
                    download_blob('https://example.test/blob', {}, Path(directory) / 'blob.part', 6)

    def test_redirect_does_not_forward_registry_token(self):
        request = urllib.request.Request('https://ghcr.io/blob', headers={'Authorization': 'Bearer synthetic', 'Range': 'bytes=1-3'})
        redirected = SafeRedirect().redirect_request(request, None, 302, 'Found', {}, 'https://cdn.example.test/blob')
        self.assertIsNone(redirected.get_header('Authorization'))
        self.assertEqual(redirected.get_header('Range'), 'bytes=1-3')

    def test_bad_digest_cannot_install_database(self):
        good = b'trusted archive'
        digest = hashlib.sha256(good).hexdigest()
        manifest = {'layers': [{'digest': 'sha256:' + digest, 'size': len(good)}]}
        class Registry:
            def open(self, request, timeout):
                return Reply(json.dumps({'token': 'synthetic'} if isinstance(request, str) else manifest).encode())
        def corrupt_download(url, headers, archive, expected):
            archive.write_bytes(b'x' * expected)
            return archive.parent / 'parts'
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict('os.environ', {'TRIVY_CACHE_DIR': directory}), \
                 patch('download_java_db.urllib.request.build_opener', return_value=Registry()), \
                 patch('download_java_db.download_blob', side_effect=corrupt_download):
                with self.assertRaisesRegex(AssertionError, 'digest mismatch'):
                    main()
            self.assertFalse((Path(directory) / 'java-db/trivy-java.db').exists())


if __name__ == '__main__':
    unittest.main()
