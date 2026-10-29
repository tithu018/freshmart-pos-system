"""Explicit Trivy policy. Exit 0=pass, 1=block, 2=review, 3=incomplete scan."""
import html
import json
from pathlib import Path
import sys

REPORTS = ('frontend-image', 'backend-image', 'dependencies', 'infrastructure')


def evaluate(directory):
    findings, errors = [], []
    for name in REPORTS:
        path = Path(directory) / (name + '.json')
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
            if report.get('SchemaVersion') != 2 or not isinstance(report.get('Results', []), list):
                raise ValueError('Invalid Trivy report schema')
            for target in report.get('Results', []):
                for kind in ('Vulnerabilities', 'Misconfigurations', 'Secrets'):
                    for finding in target.get(kind) or []:
                        severity = finding.get('Severity', '')
                        if severity not in ('HIGH', 'CRITICAL'):
                            continue
                        if kind == 'Misconfigurations' and finding.get('Status', 'FAIL') != 'FAIL':
                            continue
                        block = kind == 'Secrets' or (kind == 'Vulnerabilities' and
                            (severity == 'CRITICAL' or bool(finding.get('FixedVersion'))))
                        findings.append({
                            'report': name, 'target': target.get('Target', ''), 'kind': kind,
                            'id': finding.get('VulnerabilityID') or finding.get('ID') or finding.get('RuleID', ''),
                            'severity': severity, 'package': finding.get('PkgName', ''),
                            'installed': finding.get('InstalledVersion', ''), 'fixed': finding.get('FixedVersion', ''),
                            'title': finding.get('Title', ''), 'decision': 'BLOCK' if block else 'REVIEW',
                        })
        except (OSError, ValueError, TypeError, AttributeError) as error:
            errors.append(f'{name}: {error}')
    code = 3 if errors else 1 if any(f['decision'] == 'BLOCK' for f in findings) else 2 if findings else 0
    return code, findings, errors


def main():
    directory = Path(sys.argv[1])
    directory.mkdir(parents=True, exist_ok=True)
    code, findings, errors = evaluate(directory)
    status = {0: 'PASS', 1: 'FAIL', 2: 'REVIEW (UNSTABLE)', 3: 'INCOMPLETE / SCANNER ERROR'}[code]
    coverage = [{'report': name, 'complete': not any(e.startswith(name + ':') for e in errors),
                 'high': sum(f['report'] == name and f['severity'] == 'HIGH' for f in findings),
                 'critical': sum(f['report'] == name and f['severity'] == 'CRITICAL' for f in findings)}
                for name in REPORTS]
    summary = {'status': status, 'exitCode': code, 'scans': coverage, 'findings': findings, 'errors': errors}
    (directory / 'security-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    columns = ('report', 'target', 'id', 'severity', 'package', 'installed', 'fixed', 'decision', 'title')
    table = '<tr>' + ''.join(f'<th>{c}</th>' for c in columns) + '</tr>'
    for finding in findings:
        table += '<tr>' + ''.join(f'<td>{html.escape(str(finding[c]))}</td>' for c in columns) + '</tr>'
    # Only selected metadata is published in HTML; never render secret match contents.
    body = f'<!doctype html><html lang="en"><meta charset="utf-8"><title>FreshMart security</title><h1>{status}</h1>'
    body += '<p>Block: all CRITICAL and fixable HIGH vulnerabilities; HIGH/CRITICAL secrets. Review: unfixed HIGH vulnerabilities and infrastructure findings. No suppressions.</p>'
    body += '<p>Infrastructure is advisory because this repository includes intentionally privileged local Docker-in-Docker and local-only deployment examples. Review findings before production deployment.</p>'
    body += '<h2>Scan coverage</h2><table border="1"><tr><th>Scan</th><th>Complete</th><th>HIGH</th><th>CRITICAL</th></tr>'
    for scan in coverage:
        body += '<tr>' + ''.join('<td>' + html.escape(str(scan[key])) + '</td>' for key in ('report', 'complete', 'high', 'critical')) + '</tr>'
    body += '</table><h2>Findings</h2>'
    body += '<pre>' + html.escape('\n'.join(errors)) + '</pre><table border="1">' + table + '</table></html>'
    (directory / 'security.html').write_text(body, encoding='utf-8')
    print(f'Security gate: {status}; {len(findings)} findings; {len(errors)} scan errors')
    return 0 if '--report-only' in sys.argv else code


if __name__ == '__main__':
    sys.exit(main())
