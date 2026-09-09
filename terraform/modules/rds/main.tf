resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.subnet_ids
  tags       = merge(var.tags, { Name = "${var.name_prefix}-db-subnets" })
}

resource "aws_rds_cluster_parameter_group" "this" {
  name   = "${var.name_prefix}-aurora-pg16"
  family = "aurora-postgresql16"

  parameter {
    name  = "log_min_messages"
    value = "warning"
  }

  tags = var.tags
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = "${var.name_prefix}-aurora-pg"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = var.engine_version

  database_name   = var.db_name
  master_username = var.db_username
  master_password = var.db_password
  port            = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = var.security_group_ids

  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.this.name

  serverlessv2_scaling_configuration {
    min_capacity = var.serverless_min_capacity
    max_capacity = var.serverless_max_capacity
  }

  storage_encrypted = true

  backup_retention_period      = var.backup_retention_days
  preferred_backup_window      = "20:00-21:00" # 01:30-02:30 IST
  preferred_maintenance_window = "sun:21:30-sun:22:30"
  copy_tags_to_snapshot        = true
  deletion_protection          = var.deletion_protection
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${var.name_prefix}-aurora-pg-final"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  apply_immediately = false

  tags = merge(var.tags, { Name = "${var.name_prefix}-aurora-pg" })
}

resource "aws_rds_cluster_instance" "this" {
  count = var.cluster_instances_count

  identifier         = "${var.name_prefix}-aurora-pg-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.this.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.this.engine
  engine_version     = aws_rds_cluster.this.engine_version

  db_subnet_group_name = aws_db_subnet_group.this.name
  publicly_accessible  = false

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = merge(var.tags, { Name = "${var.name_prefix}-aurora-pg-${count.index + 1}" })
}
