"""Trigger/query the loopback-only Jenkins job without passwords in command arguments/logs."""
import argparse
import base64
import http.cookiejar
import json
import sys
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding='utf-8')
BASE = 'http://localhost:8085/'
parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['start', 'status', 'reports', 'console', 'check'])
parser.add_argument('--build', type=int)
args = parser.parse_args()
password = (ROOT / '.local/admin-password.txt').read_text().strip()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders = [('Authorization', 'Basic ' + base64.b64encode(('admin:' + password).encode()).decode())]


def request(path, data=None, headers=None):
    req = urllib.request.Request(BASE + path, data=data, headers=headers or {})
    return opener.open(req, timeout=30)


try:
    if args.action == 'check':
        config = json.load(request('api/json'))
        assert config['useSecurity'] and config['useCrumbs'] and config['numExecutors'] == 0
        try:
            urllib.request.urlopen(BASE + 'api/json', timeout=10)
        except urllib.error.HTTPError as error:
            assert error.code in (401, 403)
        else:
            raise AssertionError('Anonymous access was not rejected')
        try:
            request('whoAmI/api/json', data=b'')
        except urllib.error.HTTPError as error:
            assert error.code == 403
        else:
            raise AssertionError('Authenticated POST without CSRF crumb was not rejected')
        node = json.load(request('computer/freshmart-agent/api/json'))
        assert not node['offline'] and node['numExecutors'] == 1
        print('PASS: authentication required, CSRF enforced, controller executors=0, dedicated agent online with one executor')
    elif args.action == 'start':
        crumb = json.load(request('crumbIssuer/api/json'))
        response = request('job/freshmart-local/buildWithParameters',
                           urllib.parse.urlencode({'SOURCE_MODE': 'local-snapshot'}).encode(),
                           {crumb['crumbRequestField']: crumb['crumb']})
        print('Queued FreshMart pipeline:', response.headers.get('Location', ''))
    else:
        build = str(args.build) if args.build else 'lastBuild'
        path = f'job/freshmart-local/{build}/'
        if args.action == 'console':
            # Console contains tool diagnostics; never add credential printing to the pipeline.
            print(request(path + 'consoleText').read().decode()[-16000:])
        elif args.action == 'reports':
            dest = ROOT / '.local' / ('reports-' + build)
            dest.mkdir(exist_ok=True)
            (dest / 'reports.zip').write_bytes(request(path + 'artifact/*zip*/archive.zip').read())
            print('Downloaded archived reports to', dest)
        else:
            result = json.load(request(path + 'api/json'))
            print(json.dumps({key: result.get(key) for key in ('number', 'result', 'building', 'duration', 'url')}, indent=2))
            for action in result.get('actions', []):
                if 'totalCount' in action:
                    print('JUnit:', json.dumps({k: action.get(k) for k in ('totalCount', 'failCount', 'skipCount')}))
except urllib.error.HTTPError as error:
    raise SystemExit(f'Jenkins HTTP {error.code}. Check controller readiness, job/build existence and local credentials.')
except urllib.error.URLError:
    raise SystemExit('Jenkins unavailable at http://localhost:8085; start the local Compose stack first.')
