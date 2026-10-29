"""Overlay only Task 15 source, never arbitrary untracked/ignored workspace files."""
import io
import hashlib
from pathlib import Path
import subprocess
import sys
import tarfile

repo, output = map(Path, sys.argv[1:])
files = [repo / 'Jenkinsfile', repo / 'frontend/Dockerfile', repo / 'backend/Dockerfile'] + sorted((repo / 'devops/jenkins').glob('*'))
files = [p for p in files if p.is_file() and (
    p.suffix in ('.py', '.ps1', '.groovy', '.sh', '.txt', '.yaml', '.md', '.Dockerfile')
    or p.name in ('Jenkinsfile', 'Dockerfile', '.dockerignore'))]
overlays = {p.relative_to(repo).as_posix(): p for p in files}
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
with tarfile.open(output / 'base.tar') as base, tarfile.open(output / 'source.tar', 'w') as dest:
    for member in base:
        if member.name not in overlays:
            dest.addfile(member, base.extractfile(member) if member.isfile() else None)
    for name, path in overlays.items():
        dest.add(path, arcname=name)
    manifest = '\n'.join(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + name
                         for name, path in overlays.items())
    provenance = (revision + '\nLocal snapshot: tracked HEAD plus explicit devops/jenkins, Jenkinsfile and application Dockerfile working files.\n'
                  + 'SHA-256 of working overlays:\n' + manifest + '\n').encode()
    info = tarfile.TarInfo('SOURCE-REVISION.txt')
    info.size = len(provenance)
    dest.addfile(info, io.BytesIO(provenance))
(output / 'Jenkinsfile').write_bytes((repo / 'Jenkinsfile').read_bytes())
print(f'Snapshot base {revision}; {len(overlays)} explicit Task 15 overlays.')
