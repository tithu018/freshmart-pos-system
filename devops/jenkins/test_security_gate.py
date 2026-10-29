import json
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys
from security_gate import REPORTS, evaluate


class SecurityGateTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for report in REPORTS:
            (self.root / (report + '.json')).write_text(json.dumps({'SchemaVersion': 2, 'Results': []}))

    def finding(self, kind, **data):
        (self.root / 'frontend-image.json').write_text(json.dumps({'SchemaVersion': 2, 'Results': [{kind: [data]}]}))
        return evaluate(self.root)[0]

    def test_clean_passes(self):
        self.assertEqual(evaluate(self.root)[0], 0)

    def test_fixable_high_blocks(self):
        self.assertEqual(self.finding('Vulnerabilities', Severity='HIGH', FixedVersion='2'), 1)

    def test_unfixed_critical_blocks(self):
        self.assertEqual(self.finding('Vulnerabilities', Severity='CRITICAL'), 1)

    def test_unfixed_high_requires_review(self):
        self.assertEqual(self.finding('Vulnerabilities', Severity='HIGH'), 2)

    def test_infrastructure_requires_review(self):
        self.assertEqual(self.finding('Misconfigurations', Severity='CRITICAL', Status='FAIL'), 2)

    def test_secret_blocks(self):
        self.assertEqual(self.finding('Secrets', Severity='HIGH'), 1)

    def test_missing_scan_fails_closed(self):
        (self.root / 'backend-image.json').unlink()
        self.assertEqual(evaluate(self.root)[0], 3)

    def test_malformed_scan_fails_closed(self):
        (self.root / 'backend-image.json').write_text('{}')
        self.assertEqual(evaluate(self.root)[0], 3)

    def test_redaction_preserves_gate_without_exposing_match(self):
        raw = self.root / 'private.json'
        redacted = self.root / 'dependencies.json'
        raw.write_text(json.dumps({'SchemaVersion': 2, 'Results': [{'Secrets': [{
            'Severity': 'HIGH', 'RuleID': 'test', 'Match': 'synthetic-sensitive-match',
            'Code': {'Lines': [{'Content': 'synthetic-sensitive-match'}]}
        }]}]}))
        subprocess.run([sys.executable, str(Path(__file__).with_name('redact_secrets.py')), str(raw), str(redacted)], check=True)
        self.assertNotIn('synthetic-sensitive-match', redacted.read_text())
        self.assertEqual(evaluate(self.root)[0], 1)


if __name__ == '__main__':
    unittest.main()
