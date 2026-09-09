output "alb_dns_name" {
  value = module.alb.alb_dns_name
}

output "api_url" {
  value = "https://${var.api_domain}"
}

output "github_actions_user_name" {
  value = module.iam.github_actions_user_name
}

output "github_actions_access_key_id" {
  value = module.iam.github_actions_access_key_id
}

output "github_actions_secret_access_key" {
  value     = module.iam.github_actions_secret_access_key
  sensitive = true
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "ecs_cluster_name" {
  value = module.ecs_cluster.cluster_name
}

output "ecs_service_names" {
  value = {
    api         = module.service_api.service_name
    mail_worker = module.service_mail_worker.service_name
  }
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "redis_endpoint" {
  value = var.create_redis ? module.elasticache[0].primary_endpoint : var.existing_redis_host
}

output "s3_bucket" {
  value = module.s3.bucket_name
}

output "cloudwatch_dashboard" {
  value = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards/dashboard/${module.cloudwatch.dashboard_name}"
}

output "frontend_url" {
  value = module.frontend.url
}

output "frontend_bucket" {
  description = "Sync the frontend static export here: aws s3 sync apps/hr_portal/out/ s3://<bucket>/"
  value       = module.frontend.bucket_name
}

output "frontend_distribution_id" {
  value = module.frontend.distribution_id
}

output "ses_identity_arn" {
  value = module.ses.identity_arn
}

output "database_url_secret_arn" {
  description = "Secrets Manager ARN holding the Prisma DATABASE_URL"
  value       = module.secrets.database_url_secret_arn
}
