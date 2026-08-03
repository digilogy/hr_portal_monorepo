// =============================================================================
// hr-portal — production CI/CD pipeline
//
// Flow: checkout -> install -> lint/test -> build+push 2 images ->
//       DB migration (one-off ECS task) -> deploy 2 ECS services ->
//       health check -> (automatic rollback on failure) -> cleanup -> notify
//
// Requirements on the Jenkins host (provisioned by terraform/modules/jenkins):
//   docker, aws cli v2, node 22, git; instance profile with ECR/ECS permissions
// =============================================================================
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30'))
        timeout(time: 60, unit: 'MINUTES')
    }

    environment {
        AWS_REGION  = 'ap-south-1'
        NAME_PREFIX = 'hr-portal-prod'
        ECR_PREFIX  = 'hr-portal-prod'
        CLUSTER     = 'hr-portal-prod-cluster'
        API_DOMAIN  = 'api.example.com'
        FRONTEND_BUCKET          = 'hr-portal-prod-frontend-CHANGE-ME'
        FRONTEND_DISTRIBUTION_ID = 'CHANGE-ME'
        IMAGE_TAG   = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'manual'}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-" + sh(
                        script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
                }
                echo "Image tag for this build: ${env.IMAGE_TAG}"
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'node --version && npm --version'
                sh 'npm ci --ignore-scripts'
            }
        }

        stage('Lint & Test') {
            steps {
                // Both are workspace passthroughs today; they become real
                // gates as soon as lint configs/tests are added per workspace.
                sh 'npm run lint --if-present'
                sh 'npm test'
            }
        }

        stage('Build & Push Images') {
            steps {
                sh 'chmod +x scripts/deploy/*.sh'
                sh "./scripts/deploy/build-and-push.sh ${IMAGE_TAG}"
            }
        }

        stage('Database Migration') {
            steps {
                // Runs `prisma migrate deploy` as a one-off Fargate task with
                // the NEW image, before any service rollout.
                sh "./scripts/deploy/run-migrations.sh ${IMAGE_TAG}"
            }
        }

        stage('Deploy Services') {
            steps {
                script {
                    // Background service first, then the user-facing API.
                    // deploy-service.sh waits for stability and fails the
                    // build if the ECS circuit breaker rolls back.
                    for (svc in ['mail-worker', 'api']) {
                        sh "./scripts/deploy/deploy-service.sh ${svc} ${IMAGE_TAG}"
                    }
                }
            }
        }

        stage('Health Check') {
            steps {
                sh "./scripts/deploy/health-check.sh ${API_DOMAIN}"
            }
        }

        stage('Deploy Frontend') {
            when {
                // Only rebuild/redeploy the frontend when it (or shared
                // packages) changed
                anyOf {
                    changeset 'apps/hr_portal/**'
                    changeset 'packages/common/**'
                    expression { currentBuild.number == 1 }
                }
            }
            steps {
                sh '''
                    cd apps/hr_portal
                    npm ci
                    npm run build
                    aws s3 sync out/ "s3://${FRONTEND_BUCKET}/" --delete --region ${AWS_REGION}
                    aws cloudfront create-invalidation \
                        --distribution-id ${FRONTEND_DISTRIBUTION_ID} --paths "/*"
                '''
            }
        }
    }

    post {
        failure {
            echo 'Deployment failed. ECS circuit breaker rolls back failed services automatically.'
            echo 'For manual rollback of a specific service: ./scripts/deploy/rollback.sh <service>'
            // TODO(notifications): wire Slack/SES here, e.g.:
            // slackSend channel: '#deployments', color: 'danger',
            //           message: "FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER} (${env.IMAGE_TAG})"
        }
        success {
            echo "Deployed ${env.IMAGE_TAG} successfully to production."
            // TODO(notifications): wire Slack/SES here, e.g.:
            // slackSend channel: '#deployments', color: 'good',
            //           message: "DEPLOYED: ${env.JOB_NAME} #${env.BUILD_NUMBER} (${env.IMAGE_TAG})"
        }
        always {
            // Keep the Jenkins disk healthy: drop dangling layers and any
            // images older than 7 days that aren't in use.
            sh 'docker image prune -f || true'
            sh 'docker image prune -af --filter "until=168h" || true'
            cleanWs(deleteDirs: true, notFailBuild: true)
        }
    }
}
