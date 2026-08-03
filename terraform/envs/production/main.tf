locals {
  name_prefix = "${var.project}-${var.environment}"

  tags = {
    Project     = var.project
    Environment = var.environment
  }

  # Environment shared by every service container (non-secret values only)
  common_environment = {
    NODE_ENV        = "production"
    TZ              = "Asia/Kolkata"
    AWS_REGION      = var.aws_region
    AWS_S3_BUCKET   = module.s3.bucket_name
    SES_FROM_EMAIL  = var.ses_from_email
    FRONTEND_URL    = "https://${var.frontend_domain}"
    ALLOWED_ORIGINS = var.allowed_origins
    DB_HOST         = module.rds.address
    DB_PORT         = tostring(module.rds.port)
    DB_USER         = module.rds.db_username
    DB_NAME         = module.rds.db_name
    REDIS_HOST      = module.elasticache.primary_endpoint
    REDIS_PORT      = tostring(module.elasticache.port)
  }

  # Secrets injected by ECS from Secrets Manager (never plaintext in task defs)
  common_secrets = {
    DB_PASSWORD = module.secrets.db_password_secret_arn
    JWT_SECRET  = module.secrets.jwt_secret_arn
    ADMIN_USER  = aws_secretsmanager_secret.admin_user.arn
    ADMIN_PIN   = aws_secretsmanager_secret.admin_pin.arn
  }
}

data "aws_route53_zone" "this" {
  name         = var.root_domain
  private_zone = false
}

data "aws_caller_identity" "current" {}

# =============================================================================
# Networking
# =============================================================================
module "vpc" {
  source = "../../modules/vpc"

  name_prefix               = local.name_prefix
  vpc_cidr                  = var.vpc_cidr
  azs                       = var.azs
  public_subnet_cidrs       = var.public_subnet_cidrs
  private_app_subnet_cidrs  = var.private_app_subnet_cidrs
  private_data_subnet_cidrs = var.private_data_subnet_cidrs
  nat_gateway_count         = var.nat_gateway_count
  tags                      = local.tags
}

module "security_groups" {
  source = "../../modules/security-groups"

  name_prefix         = local.name_prefix
  vpc_id              = module.vpc.vpc_id
  jenkins_admin_cidrs = var.jenkins_admin_cidrs
  tags                = local.tags
}

# =============================================================================
# Registry & storage
# =============================================================================
module "ecr" {
  source = "../../modules/ecr"

  name_prefix  = local.name_prefix
  repositories = ["api", "mail-worker"]
  tags         = local.tags
}

module "s3" {
  source = "../../modules/s3"

  bucket_name          = var.s3_bucket_name
  cors_allowed_origins = [var.allowed_origins]
  tags                 = local.tags
}

# =============================================================================
# Data layer
# =============================================================================
resource "random_password" "db" {
  length  = 32
  special = false # keep it URL-safe for Prisma's DATABASE_URL
}

module "rds" {
  source = "../../modules/rds"

  name_prefix        = local.name_prefix
  subnet_ids         = module.vpc.private_data_subnet_ids
  security_group_ids = [module.security_groups.rds_sg_id]
  instance_class     = var.rds_instance_class
  multi_az           = var.rds_multi_az
  db_password        = random_password.db.result
  tags               = local.tags
}

module "elasticache" {
  source = "../../modules/elasticache"

  name_prefix        = local.name_prefix
  subnet_ids         = module.vpc.private_data_subnet_ids
  security_group_ids = [module.security_groups.redis_sg_id]
  node_type          = var.redis_node_type
  num_cache_nodes    = var.redis_num_nodes
  tags               = local.tags
}

# =============================================================================
# Secrets & parameters
# =============================================================================
resource "aws_secretsmanager_secret" "admin_user" {
  name                    = "${local.name_prefix}/admin-user"
  description             = "Admin login email"
  recovery_window_in_days = 7
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "admin_user" {
  secret_id     = aws_secretsmanager_secret.admin_user.id
  secret_string = var.admin_user
}

resource "aws_secretsmanager_secret" "admin_pin" {
  name                    = "${local.name_prefix}/admin-pin"
  description             = "Admin login PIN"
  recovery_window_in_days = 7
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "admin_pin" {
  secret_id     = aws_secretsmanager_secret.admin_pin.id
  secret_string = var.admin_pin
}

module "secrets" {
  source = "../../modules/secrets"

  name_prefix = local.name_prefix
  db_password = random_password.db.result

  database_url = format(
    "mysql://%s:%s@%s:%d/%s",
    module.rds.db_username,
    random_password.db.result,
    module.rds.address,
    module.rds.port,
    module.rds.db_name,
  )

  parameters = {
    "allowed-origins" = var.allowed_origins
    "ses-from-email"  = var.ses_from_email
    "s3-bucket"       = module.s3.bucket_name
  }

  tags = local.tags
}

# =============================================================================
# Frontend — S3 + CloudFront static hosting for the Next.js static export
# =============================================================================
module "frontend" {
  source = "../../modules/frontend"

  providers = {
    aws      = aws
    aws.use1 = aws.use1
  }

  name_prefix     = local.name_prefix
  domain          = var.frontend_domain
  bucket_name     = "${local.name_prefix}-frontend-${data.aws_caller_identity.current.account_id}"
  route53_zone_id = data.aws_route53_zone.this.zone_id
  tags            = local.tags
}

# =============================================================================
# SES — domain identity, DKIM auto-verified through Route 53
# =============================================================================
module "ses" {
  source = "../../modules/ses"

  providers = {
    aws = aws.ses
  }

  name_prefix        = local.name_prefix
  domain             = var.root_domain
  route53_zone_id    = data.aws_route53_zone.this.zone_id
  dmarc_report_email = var.alarm_email
  # No delivery_webhook_url: main-zip has no SES bounce/complaint webhook
  # route implemented yet (unlike ideas-staging-backend's
  # /api/v1/webhooks/ses) — tracking infra exists but sits dormant.
  tags = local.tags
}

# =============================================================================
# IAM
# =============================================================================
module "iam" {
  source = "../../modules/iam"

  name_prefix         = local.name_prefix
  secret_arns         = concat(module.secrets.all_secret_arns, [aws_secretsmanager_secret.admin_user.arn, aws_secretsmanager_secret.admin_pin.arn])
  s3_bucket_arn       = module.s3.bucket_arn
  ses_region          = var.ses_region
  ecr_repository_arns = values(module.ecr.repository_arns)
  ops_bucket_arns     = [module.frontend.bucket_arn]

  cloudfront_distribution_arns = [module.frontend.distribution_arn]
  tags                         = local.tags
}

# =============================================================================
# TLS & load balancing
# =============================================================================
module "acm" {
  source = "../../modules/acm"

  domain_name     = var.api_domain
  route53_zone_id = data.aws_route53_zone.this.zone_id
  tags            = local.tags
}

module "alb" {
  source = "../../modules/alb"

  name_prefix        = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  security_group_ids = [module.security_groups.alb_sg_id]
  certificate_arn    = module.acm.certificate_arn
  api_port           = 5111
  tags               = local.tags
}

# =============================================================================
# ECS cluster & services
# =============================================================================
module "ecs_cluster" {
  source = "../../modules/ecs-cluster"

  name_prefix = local.name_prefix
  tags        = local.tags
}

module "service_api" {
  source = "../../modules/ecs-service"

  name_prefix        = local.name_prefix
  service_name       = "api"
  cluster_id         = module.ecs_cluster.cluster_id
  cluster_name       = module.ecs_cluster.cluster_name
  image              = "${module.ecr.repository_urls["api"]}:${var.image_tag}"
  cpu                = var.api_cpu
  memory             = var.api_memory
  container_port     = 5111
  desired_count      = var.api_min_tasks
  environment        = merge(local.common_environment, { PORT = "5111" })
  secrets            = local.common_secrets
  execution_role_arn = module.iam.task_execution_role_arn
  task_role_arn      = module.iam.api_task_role_arn
  subnet_ids         = module.vpc.private_app_subnet_ids
  security_group_ids = [module.security_groups.app_sg_id]
  target_group_arn   = module.alb.api_target_group_arn
  region             = var.aws_region

  enable_autoscaling      = true
  min_capacity            = var.api_min_tasks
  max_capacity            = var.api_max_tasks
  cpu_target_value        = 60
  requests_per_target     = var.api_requests_per_target
  alb_arn_suffix          = module.alb.alb_arn_suffix
  target_group_arn_suffix = module.alb.api_target_group_arn_suffix

  tags = local.tags
}

module "service_mail_worker" {
  source = "../../modules/ecs-service"

  name_prefix        = local.name_prefix
  service_name       = "mail-worker"
  cluster_id         = module.ecs_cluster.cluster_id
  cluster_name       = module.ecs_cluster.cluster_name
  image              = "${module.ecr.repository_urls["mail-worker"]}:${var.image_tag}"
  cpu                = 256
  memory             = 512
  desired_count      = var.mail_worker_desired_count
  environment        = local.common_environment
  secrets            = local.common_secrets
  execution_role_arn = module.iam.task_execution_role_arn
  task_role_arn      = module.iam.mail_worker_task_role_arn
  subnet_ids         = module.vpc.private_app_subnet_ids
  security_group_ids = [module.security_groups.app_sg_id]
  region             = var.aws_region

  tags = local.tags
}

# =============================================================================
# Jenkins CI/CD host
# =============================================================================
module "jenkins" {
  source = "../../modules/jenkins"

  # EIP association requires the VPC's internet gateway to exist first
  depends_on = [module.vpc]

  name_prefix           = local.name_prefix
  subnet_id             = module.vpc.public_subnet_ids[0]
  security_group_ids    = [module.security_groups.jenkins_sg_id]
  instance_profile_name = module.iam.jenkins_instance_profile_name
  instance_type         = var.jenkins_instance_type
  key_name              = var.jenkins_key_name
  jenkins_domain        = var.jenkins_domain
  letsencrypt_email     = var.letsencrypt_email
  tags                  = local.tags
}

# =============================================================================
# DNS records
# =============================================================================
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.api_domain
  type    = "A"

  alias {
    name                   = module.alb.alb_dns_name
    zone_id                = module.alb.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "jenkins" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.jenkins_domain
  type    = "A"
  ttl     = 300
  records = [module.jenkins.public_ip]
}

# =============================================================================
# Observability
# =============================================================================
module "cloudwatch" {
  source = "../../modules/cloudwatch"

  name_prefix                 = local.name_prefix
  region                      = var.aws_region
  alarm_email                 = var.alarm_email
  alb_arn_suffix              = module.alb.alb_arn_suffix
  api_target_group_arn_suffix = module.alb.api_target_group_arn_suffix
  cluster_name                = module.ecs_cluster.cluster_name
  all_service_names = [
    module.service_api.service_name,
    module.service_mail_worker.service_name,
  ]
  rds_instance_id            = module.rds.instance_id
  redis_replication_group_id = module.elasticache.replication_group_id
  tags                       = local.tags
}
