"""Local Helm application/upgrade/rollback verification. Writes only new *_test fixtures.

Requires Install-MinikubeHelm.ps1 and Open-FreshMartHelm.ps1. Never targets AWS.
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
LOCAL = ROOT / '.local'
SMOKE = ROOT.parent / 'docker' / 'smoke.py'
RELEASE = 'freshmart-helm'
BASE = 'http://localhost:3001'


def run(args, *, stdin=None):
    return subprocess.run(args, input=stdin, check=True, capture_output=True, text=True, timeout=660).stdout.strip()


def kube(*args):
    return run(['kubectl', '--context=freshmart', '-n', 'freshmart', *args])


def helm(*args):
    return run(['helm', *args, '--kube-context', 'freshmart', '-n', 'freshmart'])


def sql(query):
    return run(['kubectl', '--context=freshmart', '-n', 'freshmart', 'exec', '-i', 'deployment/postgres',
                '--', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'freshmart', '-d', 'freshmart_kubernetes_test', '-At'], stdin=query)


def snapshot():
    # Store hashes only; do not dump financial rows, customer information or credentials.
    result = {}
    for table in ('sales', 'sale_items', 'products', 'categories', 'inventory'):
        key = 'product_id' if table == 'inventory' else 'id'
        result[table] = json.loads(sql(f"SELECT coalesce(jsonb_object_agg({key}, md5(row_to_json(t)::text)), '{{}}'::jsonb) FROM {table} t;"))
    return result


def verify_original(before):
    after = snapshot()
    for table, rows in before.items():
        assert all(after[table].get(key) == value for key, value in rows.items()), f'Existing {table} rows changed'


def ready_and_reconnected(client):
    for name in ('freshmart-helm-backend', 'freshmart-helm-frontend'):
        kube('rollout', 'status', 'deployment/' + name, '--timeout=600s')
    pods = json.loads(kube('get', 'pods', '-l', 'app.kubernetes.io/instance=' + RELEASE, '-o', 'json'))['items']
    for pod in pods:
        if pod['metadata'].get('deletionTimestamp'):
            kube('wait', '--for=delete', 'pod/' + pod['metadata']['name'], '--timeout=120s')
    for _ in range(45):
        try:
            client.request('GET', '/api/auth/me')
            return
        except (OSError, urllib.error.URLError, AssertionError):
            time.sleep(2)
    raise AssertionError('Existing session did not recover after Helm operation')


def main():
    assert run(['git', '-C', str(ROOT.parent.parent), 'branch', '--show-current']) == 'main'
    nodes = json.loads(kube('get', 'nodes', '-o', 'json'))['items']
    assert len(nodes) == 1 and nodes[0]['metadata']['name'] == 'freshmart', 'Minikube only'
    assert sql('SELECT current_database();') == 'freshmart_kubernetes_test'
    config = json.loads(kube('get', 'configmap', 'freshmart-helm-config', '-o', 'json'))['data']
    assert config['DB_NAME'] == 'freshmart_kubernetes_test' and config['DB_HOST'] == 'postgres'
    assert config['FRONTEND_ORIGINS'] == BASE
    assert config['BOOTSTRAP_USERS_ENABLED'] == 'false'
    assert LOCAL.is_dir(), 'Run Install-MinikubeHelm.ps1 to create restricted local artifact directory'
    env = (ROOT.parent / 'kubernetes' / '.local' / '.env').read_text()
    values = dict(line.split('=', 1) for line in env.splitlines() if line.strip() and not line.lstrip().startswith('#'))
    assert values['DB_NAME'] == 'freshmart_kubernetes_test'
    values['FRONTEND_PORT'] = '3001'
    env_path = LOCAL / '.env'
    env_path.write_text('\n'.join(key + '=' + value for key, value in values.items()) + '\n')
    before = snapshot()
    (LOCAL / 'baseline-hashes.json').write_text(json.dumps(before))
    state_path = LOCAL / 'smoke-state.json'
    pvc = json.loads(kube('get', 'pvc', 'postgres-data', '-o', 'json'))['metadata']['uid']
    task13 = {name: json.loads(kube('get', 'deployment', name, '-o', 'json'))['metadata']['uid']
              for name in ('backend', 'frontend', 'postgres')}
    smoke_args = [sys.executable, str(SMOKE), '--env-file', str(env_path), '--state-file', str(state_path)]
    subprocess.run(smoke_args, check=True, timeout=180)
    spec = importlib.util.spec_from_file_location('freshmart_smoke', SMOKE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    client = module.Client(BASE)
    client.login('cashier@freshmart.com', values['BOOTSTRAP_CASHIER_PASSWORD'], 'CASHIER')
    revision = json.loads(helm('status', RELEASE, '-o', 'json'))['version']
    print(f'PASS: Helm install/application checks; rollback target revision {revision}', flush=True)
    upgraded = False
    try:
        helm('upgrade', RELEASE, str(ROOT), '-f', str(ROOT / 'values-minikube.yaml'),
             '--set', 'backend.replicaCount=2,frontend.replicaCount=2',
             '--set', 'backend.probes.readiness.periodSeconds=6,frontend.probes.readiness.periodSeconds=6',
             '--wait', '--rollback-on-failure', '--timeout', '10m')
        upgraded = True
        ready_and_reconnected(client)
        for name in ('backend', 'frontend'):
            deployment = json.loads(kube('get', 'deployment', 'freshmart-helm-' + name, '-o', 'json'))
            assert deployment['status']['readyReplicas'] == 2
            assert deployment['spec']['template']['spec']['containers'][0]['readinessProbe']['periodSeconds'] == 6
        subprocess.run(smoke_args + ['--verify-existing'], check=True, timeout=180)
        client.login('cashier@freshmart.com', values['BOOTSTRAP_CASHIER_PASSWORD'], 'CASHIER')
        verify_original(before)
        print('PASS: Helm upgrade rolled both components to two replicas; login/CSRF/sales/inventory preserved', flush=True)
    finally:
        if upgraded:
            helm('rollback', RELEASE, str(revision), '--wait', '--timeout', '10m')
    ready_and_reconnected(client)
    for name in ('backend', 'frontend'):
        deployment = json.loads(kube('get', 'deployment', 'freshmart-helm-' + name, '-o', 'json'))
        assert deployment['spec']['replicas'] == 1 and deployment['status']['readyReplicas'] == 1
        assert deployment['spec']['template']['spec']['containers'][0]['readinessProbe']['periodSeconds'] == 5
    subprocess.run(smoke_args + ['--verify-existing'], check=True, timeout=180)
    verify_original(before)
    assert json.loads(kube('get', 'pvc', 'postgres-data', '-o', 'json'))['metadata']['uid'] == pvc
    for name, uid in task13.items():
        deployment = json.loads(kube('get', 'deployment', name, '-o', 'json'))
        assert deployment['metadata']['uid'] == uid and deployment['status']['readyReplicas'] == 1
    print('PASS: Rollback restored original replica/probe settings; existing session and data still valid', flush=True)
    print('PASS: All pre-existing row hashes, Task 13 deployments and original PVC preserved', flush=True)
    (LOCAL / 'helm-history.json').write_text(helm('history', RELEASE, '-o', 'json'))


if __name__ == '__main__':
    main()
