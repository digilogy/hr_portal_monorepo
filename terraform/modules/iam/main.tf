data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
}

# ===========================================================================
# ECS Task EXECUTION role — used by the ECS agent itself:
# pull images, write logs, resolve Secrets Manager values for injection.
# ===========================================================================
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${var.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "read-app-secrets"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadAppSecrets"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.secret_arns
      },
      {
        Sid      = "ReadAppParameters"
        Effect   = "Allow"
        Action   = ["ssm:GetParameters"]
        Resource = ["arn:aws:ssm:*:${local.account_id}:parameter/${var.name_prefix}/*"]
      }
    ]
  })
}

# ===========================================================================
# Per-service TASK roles — what the application code can do.
# ===========================================================================

# --- API: S3 presigned URLs (Stage 10) + SES (transactional mail) ---
resource "aws_iam_role" "api_task" {
  name               = "${var.name_prefix}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "api_task" {
  name = "api-permissions"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "UploadsBucketObjects"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = ["${var.s3_bucket_arn}/*"]
      },
      {
        Sid    = "SendTransactionalMail"
        Effect = "Allow"
        Action = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = [
          "arn:aws:ses:${var.ses_region}:${local.account_id}:identity/*",
        ]
      }
    ]
  })
}

# --- Mail worker: sends the queued emails, may touch bulk-upload files ---
resource "aws_iam_role" "mail_worker_task" {
  name               = "${var.name_prefix}-mail-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy" "mail_worker_task" {
  name = "mail-worker-permissions"
  role = aws_iam_role.mail_worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SendTransactionalMail"
        Effect = "Allow"
        Action = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = [
          "arn:aws:ses:${var.ses_region}:${local.account_id}:identity/*",
        ]
      }
    ]
  })
}

# ===========================================================================
# GitHub Actions Deployer — CI/CD: push to ECR, deploy to ECS, sync S3, CloudFront
# ===========================================================================
resource "aws_iam_policy" "github_actions" {
  name        = "${var.name_prefix}-github-actions-deploy"
  description = "Permissions for GitHub Actions to build/deploy to ECR, ECS, S3, and CloudFront"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "EcrAuth"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Sid    = "EcrPushPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:ListImages",
          "ecr:BatchDeleteImage"
        ]
        Resource = var.ecr_repository_arns
      },
      {
        Sid    = "EcsDeploy"
        Effect = "Allow"
        Action = [
          "ecs:DescribeClusters",
          "ecs:DescribeServices",
          "ecs:DescribeTasks",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:UpdateService",
          "ecs:ListTasks",
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:TagResource"
        ]
        Resource = ["*"]
      },
      {
        Sid    = "PassTaskRoles"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          aws_iam_role.task_execution.arn,
          aws_iam_role.api_task.arn,
          aws_iam_role.mail_worker_task.arn,
        ]
        Condition = {
          StringEquals = { "iam:PassedToService" = "ecs-tasks.amazonaws.com" }
        }
      },
      {
        Sid    = "OpsBuckets"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = concat(
          var.ops_bucket_arns,
          [for arn in var.ops_bucket_arns : "${arn}/*"]
        )
      },
      {
        Sid      = "FrontendInvalidation"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
        Resource = length(var.cloudfront_distribution_arns) > 0 ? var.cloudfront_distribution_arns : ["arn:aws:cloudfront::${local.account_id}:distribution/none"]
      },
      {
        Sid    = "DeployValidation"
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DescribeTargetHealth",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeLoadBalancers",
          "cloudwatch:GetMetricData",
          "logs:GetLogEvents",
          "logs:FilterLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = ["*"]
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_user" "github_actions" {
  name = "${var.name_prefix}-github-actions"
  tags = var.tags
}

resource "aws_iam_user_policy_attachment" "github_actions" {
  user       = aws_iam_user.github_actions.name
  policy_arn = aws_iam_policy.github_actions.arn
}

resource "aws_iam_access_key" "github_actions" {
  user = aws_iam_user.github_actions.name
}
