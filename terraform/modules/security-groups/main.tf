# ---------------------------------------------------------------------------
# ALB — public entry point
# ---------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "ALB: HTTP/HTTPS from the internet"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP (redirected to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "To ECS tasks only"
    from_port       = var.api_port
    to_port         = var.api_port
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-sg" })
}

# ---------------------------------------------------------------------------
# ECS tasks (api, mail-worker)
# ---------------------------------------------------------------------------
resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-app-sg"
  description = "ECS tasks: app port from ALB only, full egress"
  vpc_id      = var.vpc_id

  egress {
    description = "Outbound (NAT for SES/S3/npm, VPC for DB/Redis)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-app-sg" })
}

resource "aws_security_group_rule" "app_from_alb_api" {
  type                     = "ingress"
  description              = "API port from ALB"
  from_port                = var.api_port
  to_port                  = var.api_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.app.id
  source_security_group_id = aws_security_group.alb.id
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL
# ---------------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds-sg"
  description = "PostgreSQL from ECS tasks only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # No egress needed for RDS
  tags = merge(var.tags, { Name = "${var.name_prefix}-rds-sg" })
}

# ---------------------------------------------------------------------------
# ElastiCache Redis
# ---------------------------------------------------------------------------
resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis-sg"
  description = "Redis from ECS tasks only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis-sg" })
}

# ---------------------------------------------------------------------------
# Jenkins EC2
# ---------------------------------------------------------------------------
resource "aws_security_group" "jenkins" {
  name = "${var.name_prefix}-jenkins-sg"
  # NOTE: description is immutable on SGs — changing it forces replacement,
  # which fails while the SG is attached to the running Jenkins instance.
  description = "Jenkins: SSH/HTTP/HTTPS from admin CIDRs"
  vpc_id      = var.vpc_id

  ingress {
    description = "SSH (admin IPs only)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.jenkins_admin_cidrs
  }

  ingress {
    description = "HTTP (Lets Encrypt challenge + redirect)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS (Jenkins UI, login enforced by Jenkins/GitHub OAuth)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Outbound (AWS APIs, apt, Docker Hub, git)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-jenkins-sg" })
}
