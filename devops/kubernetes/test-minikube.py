"""Destructive resilience checks ONLY for the dedicated local FreshMart test cluster.

Creates catalog/sales fixtures, replaces Pods and rolls deployments; retains the PVC.
Start Open-FreshMart.ps1 first. Uses only Python's standard library.
"""
import importlib.util
import json
import pathlib
import subprocess
import sys
import time
import urllib.error

sys.dont_write_bytecode = True

ROOT = pathlib.Path(__file__).resolve().parent
ENV = ROOT / '.local' / '.env'
STATE = ROOT / '.local' / 'smoke-state.json'
SMOKE = ROOT.parent / 'docker' / 'smoke.py'
BASE = 'http://localhost:3000'


def kubectl(*args, json_output=False):
    result = subprocess.run(['kubectl', '--context=freshmart', '-n', 'freshmart', *args],
                            check=True, capture_output=True, text=True, timeout=660)
    return json.loads(result.stdout) if json_output else result.stdout.strip()


def ready(name):
    kubectl('rollout', 'status', 'deployment/' + name, '--timeout=600s')


def wait_for_retired_pods(name):
    # Rollout status can succeed while a port-forward's old Pod is still terminating.
    pods = kubectl('get', 'pods', '-l', 'app=' + name, '-o', 'json', json_output=True)['items']
    for pod in pods:
        if pod['metadata'].get('deletionTimestamp'):
            kubectl('wait', '--for=delete', 'pod/' + pod['metadata']['name'], '--timeout=120s')


def recover(client):
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        try:
            client.request('GET', '/api/auth/me')
            return
        except (OSError, urllib.error.URLError, AssertionError):
            time.sleep(2)
    raise AssertionError('API/session did not recover within 90 seconds')


def main():
    config = dict(line.split('=', 1) for line in ENV.read_text().splitlines()
                  if line.strip() and not line.lstrip().startswith('#'))
    assert config['DB_NAME'] == 'freshmart_kubernetes_test'
    assert config['FRONTEND_PORT'] == '3000'
    nodes = kubectl('get', 'nodes', '-o', 'json', json_output=True)['items']
    assert len(nodes) == 1 and nodes[0]['metadata']['name'] == 'freshmart', 'Local Minikube only'
    live_config = kubectl('get', 'configmap', 'freshmart-config', '-o', 'json', json_output=True)['data']
    assert live_config['DB_NAME'] == config['DB_NAME'] and live_config['BOOTSTRAP_USERS_ENABLED'] == 'false'
    actual_db = kubectl('exec', 'deployment/postgres', '--', 'sh', '-c',
                       'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select current_database()"')
    assert actual_db == config['DB_NAME'], 'Refusing writes outside the dedicated test database'
    backend = kubectl('get', 'deployment', 'backend', '-o', 'json', json_output=True)
    overrides = backend['spec']['template']['spec']['containers'][0].get('env', [])
    assert not any(e['name'] == 'BOOTSTRAP_USERS_ENABLED' and e.get('value') == 'true' for e in overrides)
    subprocess.run([sys.executable, str(SMOKE), '--env-file', str(ENV), '--state-file', str(STATE)], check=True)
    spec = importlib.util.spec_from_file_location('docker_smoke', SMOKE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    client = module.Client(BASE)
    client.login('cashier@freshmart.com', config['BOOTSTRAP_CASHIER_PASSWORD'], 'CASHIER')
    pvc_uid = kubectl('get', 'pvc', 'postgres-data', '-o', 'json', json_output=True)['metadata']['uid']
    try:
        for name in ('backend', 'frontend'):
            kubectl('scale', 'deployment/' + name, '--replicas=2')
            ready(name)
            assert kubectl('get', 'deployment', name, '-o', 'json', json_output=True)['status']['readyReplicas'] == 2
        for _ in range(10):
            client.request('GET', '/api/auth/me')
            client.request('GET', '/api/auth/csrf')
        print('PASS: Frontend/backend scale to two replicas; shared JWT and CSRF work', flush=True)
        # Exercise POST + CSRF through the Service while two backends are available.
        client.login('cashier@freshmart.com', config['BOOTSTRAP_CASHIER_PASSWORD'], 'CASHIER')
        for name in ('backend', 'frontend', 'postgres'):
            pods = kubectl('get', 'pods', '-l', 'app=' + name, '-o', 'json', json_output=True)['items']
            old = pods[0]['metadata']
            kubectl('delete', 'pod', old['name'], '--wait=true', '--timeout=120s')
            ready(name)
            current = kubectl('get', 'pods', '-l', 'app=' + name, '-o', 'json', json_output=True)['items']
            assert old['uid'] not in {p['metadata']['uid'] for p in current}
            recover(client)
            print('PASS: ' + name + ' Pod replaced automatically; session recovered', flush=True)
        assert kubectl('get', 'pvc', 'postgres-data', '-o', 'json', json_output=True)['metadata']['uid'] == pvc_uid
        subprocess.run([sys.executable, str(SMOKE), '--env-file', str(ENV), '--state-file', str(STATE),
                        '--verify-existing'], check=True)
        # A held login session must continue working throughout a backend rolling restart.
        old_uids = {p['metadata']['uid'] for p in kubectl('get', 'pods', '-l', 'app=backend', '-o', 'json', json_output=True)['items']}
        kubectl('rollout', 'restart', 'deployment/backend')
        process = subprocess.Popen(['kubectl', '--context=freshmart', '-n', 'freshmart', 'rollout',
                                    'status', 'deployment/backend', '--timeout=600s'], stdout=subprocess.DEVNULL)
        checks = 0
        while process.poll() is None:
            client.request('GET', '/api/auth/me')
            checks += 1
            time.sleep(1)
        assert process.returncode == 0
        current_uids = {p['metadata']['uid'] for p in kubectl('get', 'pods', '-l', 'app=backend', '-o', 'json', json_output=True)['items']
                        if not p['metadata'].get('deletionTimestamp')}
        assert old_uids.isdisjoint(current_uids)
        print(f'PASS: Backend rolling restart, {checks} authenticated requests, zero failed requests', flush=True)
        kubectl('rollout', 'restart', 'deployment/frontend')
        ready('frontend')
        wait_for_retired_pods('frontend')
        recover(client)
        print('PASS: Frontend rolling restart and local port-forward reconnection', flush=True)
    finally:
        for name in ('backend', 'frontend'):
            kubectl('scale', 'deployment/' + name, '--replicas=1')
            ready(name)
            wait_for_retired_pods(name)
    recover(client)
    subprocess.run([sys.executable, str(SMOKE), '--env-file', str(ENV), '--state-file', str(STATE),
                    '--verify-existing'], check=True)
    print('PASS: Resilience checks complete; replicas restored to one; database volume retained', flush=True)


if __name__ == '__main__':
    main()
