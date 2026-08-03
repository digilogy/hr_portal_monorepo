resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name_prefix}-redis-subnets"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_elasticache_parameter_group" "this" {
  name   = "${var.name_prefix}-redis7"
  family = "redis7"

  # REQUIRED for BullMQ: jobs must never be evicted under memory pressure
  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }

  tags = var.tags
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "Redis for BullMQ mail queue, session/setup-token cache, and rate limiting"

  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.this.name

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = var.security_group_ids

  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled           = var.num_cache_nodes > 1

  at_rest_encryption_enabled = true
  # In-transit encryption off: BullMQ latency-sensitive, access restricted to
  # the app security group inside private subnets. Enable + switch app to
  # rediss:// if compliance requires it.
  transit_encryption_enabled = false

  snapshot_retention_limit = 1
  snapshot_window          = "19:30-20:30"
  maintenance_window       = "sun:22:30-sun:23:30"

  apply_immediately = false

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis" })
}
