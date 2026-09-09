# ---------------------------------------------------------------------------
# Alarm notifications
# ---------------------------------------------------------------------------
resource "aws_sns_topic" "alarms" {
  name = "${var.name_prefix}-alarms"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ---------------------------------------------------------------------------
# ALB alarms
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.name_prefix}-alb-5xx"
  alarm_description   = "ALB targets returning elevated 5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  threshold           = 25
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  alarm_name          = "${var.name_prefix}-alb-p95-latency"
  alarm_description   = "p95 response time above 300ms SLO"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  period              = 60
  evaluation_periods  = 5
  datapoints_to_alarm = 3
  threshold           = 0.3
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_unhealthy_hosts" {
  alarm_name          = "${var.name_prefix}-api-unhealthy-hosts"
  alarm_description   = "Unhealthy targets in the api target group"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.api_target_group_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = var.tags
}

# ---------------------------------------------------------------------------
# ECS service alarms
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  for_each = toset(var.all_service_names)

  alarm_name          = "${var.name_prefix}-${each.value}-cpu-high"
  alarm_description   = "Sustained high CPU on ${each.value} (autoscaling may be at max)"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = each.value
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  for_each = toset(var.all_service_names)

  alarm_name          = "${var.name_prefix}-${each.value}-memory-high"
  alarm_description   = "Sustained high memory on ${each.value}"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = each.value
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = var.tags
}

# ---------------------------------------------------------------------------
# RDS Aurora PostgreSQL alarms
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.name_prefix}-rds-cpu-high"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    DBClusterIdentifier = var.rds_cluster_id != "" ? var.rds_cluster_id : var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.name_prefix}-rds-connections-high"
  alarm_description   = "Approaching Aurora connection limit; check pool size"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 300
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    DBClusterIdentifier = var.rds_cluster_id != "" ? var.rds_cluster_id : var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  tags          = var.tags
}

# ---------------------------------------------------------------------------
# ElastiCache Serverless Redis alarms
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.name_prefix}-redis-cpu-high"
  namespace           = "AWS/ElastiCache"
  metric_name         = "ElastiCacheProcessingUnits"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 4000
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    ServerlessCacheName = var.serverless_cache_name != "" ? var.serverless_cache_name : var.redis_replication_group_id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  tags          = var.tags
}

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = "${var.name_prefix}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6
        properties = {
          title  = "ALB Requests & Errors"
          region = var.region
          stat   = "Sum"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix],
            [".", "HTTPCode_Target_5XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."]
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6
        properties = {
          title  = "ALB Target Response Time (p50/p95/p99)"
          region = var.region
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, { stat = "p50" }],
            ["...", { stat = "p95" }],
            ["...", { stat = "p99" }]
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6
        properties = {
          title  = "ECS CPU Utilization"
          region = var.region
          stat   = "Average"
          period = 60
          metrics = [
            for s in var.all_service_names :
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.cluster_name, "ServiceName", s]
          ]
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6
        properties = {
          title  = "ECS Memory Utilization"
          region = var.region
          stat   = "Average"
          period = 60
          metrics = [
            for s in var.all_service_names :
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.cluster_name, "ServiceName", s]
          ]
        }
      },
      {
        type = "metric", x = 0, y = 12, width = 8, height = 6
        properties = {
          title  = "Healthy Targets (api)"
          region = var.region
          stat   = "Minimum"
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", var.api_target_group_arn_suffix, "LoadBalancer", var.alb_arn_suffix]
          ]
        }
      },
      {
        type = "metric", x = 8, y = 12, width = 8, height = 6
        properties = {
          title  = "RDS: CPU / Connections"
          region = var.region
          period = 300
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBClusterIdentifier", var.rds_cluster_id != "" ? var.rds_cluster_id : var.rds_instance_id],
            [".", "DatabaseConnections", ".", "."]
          ]
        }
      },
      {
        type = "metric", x = 16, y = 12, width = 8, height = 6
        properties = {
          title  = "Redis: ElastiCache Processing Units"
          region = var.region
          period = 300
          metrics = [
            ["AWS/ElastiCache", "ElastiCacheProcessingUnits", "ServerlessCacheName", var.serverless_cache_name != "" ? var.serverless_cache_name : var.redis_replication_group_id]
          ]
        }
      }
    ]
  })
}
