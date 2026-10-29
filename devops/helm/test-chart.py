"""Offline chart contract tests. Requires Helm 4 and requirements-test.txt."""
import pathlib
import subprocess
import unittest
import yaml

ROOT = pathlib.Path(__file__).resolve().parent


def render(profile='minikube', overrides=(), release='freshmart-helm'):
    args = ['helm', 'template', release, str(ROOT), '-n', 'freshmart',
            '-f', str(ROOT / ('values-' + profile + '.yaml'))]
    for value in overrides:
        args.extend(['--set', value])
    return subprocess.run(args, capture_output=True, text=True, timeout=60)


class ChartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profiles = {}
        for profile in ('minikube', 'eks'):
            result = render(profile)
            assert result.returncode == 0, result.stderr
            cls.profiles[profile] = [d for d in yaml.safe_load_all(result.stdout) if d]

    def objects(self, profile, kind):
        return [d for d in self.profiles[profile] if d['kind'] == kind]

    def test_database_secret_and_namespace_never_owned(self):
        for profile, objects in self.profiles.items():
            self.assertFalse({'Secret', 'PersistentVolumeClaim', 'PersistentVolume', 'Namespace', 'StatefulSet'} & {d['kind'] for d in objects})
            self.assertEqual(len(self.objects(profile, 'Deployment')), 2)
            self.assertFalse(any(d['metadata']['name'] in ['postgres', 'backend', 'frontend', 'freshmart-config'] for d in objects))

    def test_local_existing_database_and_origin(self):
        config = next(d['data'] for d in self.objects('minikube', 'ConfigMap') if 'DB_HOST' in d['data'])
        self.assertEqual(config['DB_HOST'], 'postgres')
        self.assertEqual(config['FRONTEND_ORIGINS'], 'http://localhost:3001')
        self.assertEqual(config['SPRING_PROFILES_ACTIVE'], 'prod')
        self.assertEqual(config['BOOTSTRAP_USERS_ENABLED'], 'false')
        self.assertFalse(self.objects('minikube', 'Ingress'))

    def test_services_do_not_match_task13_selectors(self):
        for profile in self.profiles:
            for service in self.objects(profile, 'Service'):
                self.assertEqual(service['spec']['type'], 'ClusterIP')
                self.assertNotIn('app', service['spec']['selector'])
                self.assertEqual(service['spec']['selector']['app.kubernetes.io/instance'], 'freshmart-helm')

    def test_security_resources_and_probes(self):
        for profile in self.profiles:
            for dep in self.objects(profile, 'Deployment'):
                pod = dep['spec']['template']['spec']
                self.assertFalse(pod['automountServiceAccountToken'])
                self.assertTrue(pod['securityContext']['runAsNonRoot'])
                for container in pod['containers'] + pod.get('initContainers', []):
                    self.assertFalse(container['securityContext']['allowPrivilegeEscalation'])
                    self.assertTrue(container['securityContext']['readOnlyRootFilesystem'])
                    self.assertEqual(container['securityContext']['capabilities']['drop'], ['ALL'])
                    self.assertIn('requests', container['resources'])
                    self.assertIn('limits', container['resources'])
                for probe in ('startupProbe', 'readinessProbe', 'livenessProbe'):
                    self.assertIn(probe, pod['containers'][0])

    def test_backend_only_explicit_secret_keys(self):
        for profile in self.profiles:
            for dep in self.objects(profile, 'Deployment'):
                container = dep['spec']['template']['spec']['containers'][0]
                if container['name'] == 'backend':
                    self.assertEqual({e['name'] for e in container['env']}, {'DB_PASSWORD', 'JWT_SECRET'})
                    self.assertTrue(all('secretKeyRef' in e['valueFrom'] for e in container['env']))
                else:
                    self.assertNotIn('env', container)
                    self.assertNotIn('envFrom', container)

    def test_eks_verified_rds_tls_and_ca_mount(self):
        config = next(d['data'] for d in self.objects('eks', 'ConfigMap') if 'DB_HOST' in d['data'])
        self.assertIn('sslmode=verify-full&sslrootcert=/etc/freshmart/rds-ca/bundle.pem', config['SPRING_DATASOURCE_URL'])
        self.assertEqual(config['AUTH_COOKIE_SECURE'], 'true')
        backend = next(d for d in self.objects('eks', 'Deployment') if d['metadata']['name'].endswith('-backend'))
        volumes = backend['spec']['template']['spec']['volumes']
        self.assertEqual(next(v for v in volumes if v['name'] == 'rds-ca')['configMap']['name'], 'freshmart-rds-ca')

    def test_eks_alb_matches_terraform_https_and_pod_port(self):
        ingress = self.objects('eks', 'Ingress')[0]
        annotations = ingress['metadata']['annotations']
        self.assertEqual(annotations['alb.ingress.kubernetes.io/listen-ports'], '[{"HTTPS":443}]')
        self.assertEqual(annotations['alb.ingress.kubernetes.io/target-type'], 'ip')
        self.assertEqual(annotations['alb.ingress.kubernetes.io/manage-backend-security-group-rules'], 'false')
        self.assertEqual(annotations['alb.ingress.kubernetes.io/healthcheck-path'], '/health')
        self.assertEqual(ingress['spec']['ingressClassName'], 'alb')
        self.assertTrue(ingress['spec']['rules'][0]['http']['paths'][0]['backend']['service']['name'].endswith('-frontend'))

    def test_proxy_preserves_same_origin_and_https(self):
        nginx = next(d['data']['nginx.conf'] for d in self.objects('eks', 'ConfigMap') if 'nginx.conf' in d['data'])
        self.assertIn('proxy_pass http://freshmart-helm-backend:8081;', nginx)
        self.assertIn('proxy_set_header X-Forwarded-Proto $forwarded_scheme;', nginx)
        self.assertIn('Strict-Transport-Security', nginx)

    def test_rollout_checksums_and_eks_spread(self):
        for dep in self.objects('eks', 'Deployment'):
            self.assertEqual(dep['spec']['strategy']['rollingUpdate'], {'maxSurge': 1, 'maxUnavailable': 0})
            self.assertEqual(dep['spec']['replicas'], 2)
            self.assertIn('checksum/config', dep['spec']['template']['metadata']['annotations'])
            self.assertEqual(dep['spec']['template']['spec']['topologySpreadConstraints'][0]['topologyKey'], 'topology.kubernetes.io/zone')
        self.assertEqual(len(self.objects('eks', 'PodDisruptionBudget')), 2)

    def test_digest_and_config_change_rollout(self):
        digest = 'sha256:' + 'a'*64
        result = render(overrides=['backend.image.digest=' + digest, 'app.storeName=Chart rollout check'])
        self.assertEqual(result.returncode, 0, result.stderr)
        docs = [d for d in yaml.safe_load_all(result.stdout) if d]
        after = next(d for d in docs if d['kind'] == 'Deployment' and d['metadata']['name'].endswith('-backend'))
        before = next(d for d in self.objects('minikube', 'Deployment') if d['metadata']['name'].endswith('-backend'))
        self.assertTrue(after['spec']['template']['spec']['containers'][0]['image'].endswith('@'+digest))
        self.assertNotEqual(before['spec']['template']['metadata']['annotations']['checksum/config'], after['spec']['template']['metadata']['annotations']['checksum/config'])

    def test_unsafe_or_malformed_values_rejected(self):
        cases = [('eks', 'app.secureCookies=false'), ('eks', 'database.tls.mode=disable'),
                 ('eks', 'database.tls.existingCaConfigMap='), ('eks', 'ingress.enabled=false'),
                 ('eks', 'app.frontendOrigin=https://wrong.example.invalid'),
                 ('eks', 'podDisruptionBudget.minAvailable=2'),
                 ('minikube', 'backend.replicaCount=0'), ('minikube', 'credentials.password=not-a-secret'),
                 ('minikube', 'database.host=bad;host'), ('minikube', 'frontend.image.digest=invalid')]
        for profile, override in cases:
            with self.subTest(override=override):
                self.assertNotEqual(render(profile, [override]).returncode, 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
