# ---------------------------------------------------------------------------
# Application secrets — generated once by Terraform, stored in Secrets Manager,
# injected into ECS task definitions via `secrets` (never plaintext env).
# ---------------------------------------------------------------------------
resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.name_prefix}/jwt-secret"
  description             = "JWT access-token signing secret"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# main-zip has a single 24h JWT and Redis-backed single-use setup/reset
# tokens (see packages/auth) — no refresh-token pair like
# ideas-staging-backend's JWT_REFRESH_SECRET, so there's nothing to add here.

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.name_prefix}/database-url"
  description             = "Full MySQL connection string for Prisma (migrations only — TypeORM is the runtime ORM)"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = var.database_url
}

# TypeORM (the runtime ORM) connects with discrete DB_HOST/DB_PORT/DB_USER/
# DB_NAME/DB_PASSWORD env vars rather than a single connection string, so the
# password needs its own secret distinct from Prisma's DATABASE_URL above.
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.name_prefix}/db-password"
  description             = "MySQL password for the app's TypeORM connection"
  recovery_window_in_days = 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

# ---------------------------------------------------------------------------
# Non-secret configuration — SSM Parameter Store
# ---------------------------------------------------------------------------
resource "aws_ssm_parameter" "config" {
  for_each = var.parameters

  name  = "/${var.name_prefix}/${each.key}"
  type  = "String"
  value = each.value
  tags  = var.tags
}
