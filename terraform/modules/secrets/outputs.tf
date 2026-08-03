output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt_secret.arn
}

output "database_url_secret_arn" {
  value = aws_secretsmanager_secret.database_url.arn
}

output "db_password_secret_arn" {
  value = aws_secretsmanager_secret.db_password.arn
}

output "all_secret_arns" {
  value = [
    aws_secretsmanager_secret.jwt_secret.arn,
    aws_secretsmanager_secret.database_url.arn,
    aws_secretsmanager_secret.db_password.arn,
  ]
}

output "parameter_arns" {
  value = { for k, p in aws_ssm_parameter.config : k => p.arn }
}
