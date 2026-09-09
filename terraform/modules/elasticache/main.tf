resource "aws_elasticache_serverless_cache" "this" {
  engine      = "redis"
  name        = "${var.name_prefix}-redis"
  description = "Serverless Redis for BullMQ mail queue, session cache, and rate limiting"

  subnet_ids         = var.subnet_ids
  security_group_ids = var.security_group_ids

  cache_usage_limits {
    data_storage {
      maximum = var.max_data_storage_gb
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = var.max_ecpu_per_second
    }
  }

  daily_snapshot_time      = "19:30"
  snapshot_retention_limit = 1

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis" })
}
