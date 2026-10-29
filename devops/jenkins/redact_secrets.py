"""Keep detection metadata but remove secret matches/source from archived Trivy reports."""
import json
from pathlib import Path
import sys

path = Path(sys.argv[1])
report = json.loads(path.read_text())
for result in report.get('Results', []):
    for secret in result.get('Secrets') or []:
        for field in ('Match', 'Code', 'CauseMetadata'):
            secret.pop(field, None)
Path(sys.argv[2]).write_text(json.dumps(report, indent=2), encoding='utf-8')
