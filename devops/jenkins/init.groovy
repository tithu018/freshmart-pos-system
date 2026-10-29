import jenkins.model.Jenkins
import hudson.model.Node
import hudson.model.Hudson
import hudson.model.User
import hudson.model.ParametersDefinitionProperty
import hudson.model.ChoiceParameterDefinition
import hudson.security.HudsonPrivateSecurityRealm
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import hudson.slaves.DumbSlave
import hudson.slaves.RetentionStrategy
import hudson.slaves.JNLPLauncher
import jenkins.slaves.JnlpAgentReceiver
import org.jenkinsci.plugins.workflow.job.WorkflowJob
import org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition

def instance = Jenkins.get()
instance.setNumExecutors(0)
instance.setSlaveAgentPort(-1)
if (!(instance.securityRealm instanceof HudsonPrivateSecurityRealm)) {
    instance.setSecurityRealm(new HudsonPrivateSecurityRealm(false))
}
if (User.getById('admin', false) == null) {
    instance.securityRealm.createAccount('admin', new File('/run/secrets/admin_password').text.trim())
}
def authorization = new FullControlOnceLoggedInAuthorizationStrategy()
authorization.setAllowAnonymousRead(false)
instance.setAuthorizationStrategy(authorization)
if (instance.getNode('freshmart-agent') == null) {
    instance.addNode(new DumbSlave('freshmart-agent', 'Isolated local CI agent', '/home/jenkins/agent', '1',
        Node.Mode.EXCLUSIVE, 'freshmart-ci', new JNLPLauncher(), new RetentionStrategy.Always(), []))
}
def secret = new File('/run/agent-secret/secret')
secret.text = JnlpAgentReceiver.DATABASE.getSecretOf('freshmart-agent')
secret.setReadable(false, false)
secret.setReadable(true, true)
secret.setWritable(false, false)
secret.setWritable(true, true)
def job = instance.getItem('freshmart-local') ?: instance.createProject(WorkflowJob, 'freshmart-local')
job.setDefinition(new CpsFlowDefinition(new File('/opt/freshmart-source/Jenkinsfile').text, true))
job.addProperty(new ParametersDefinitionProperty(new ChoiceParameterDefinition('SOURCE_MODE', ['local-snapshot', 'scm'] as String[], 'Trusted local snapshot or SCM checkout')))
job.setDescription('Local trusted-source snapshot. Refresh with Prepare-Local.ps1 before restarting Jenkins. No deployment or image publishing.')
job.save()
instance.save()
