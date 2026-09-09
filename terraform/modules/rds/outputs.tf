output "endpoint" {
  description = "host:port"
  value       = aws_rds_cluster.this.endpoint
}

output "address" {
  value = aws_rds_cluster.this.endpoint
}

output "reader_endpoint" {
  value = aws_rds_cluster.this.reader_endpoint
}

output "port" {
  value = aws_rds_cluster.this.port
}

output "db_name" {
  value = aws_rds_cluster.this.database_name
}

output "db_username" {
  value = aws_rds_cluster.this.master_username
}

output "cluster_id" {
  value = aws_rds_cluster.this.id
}

output "cluster_identifier" {
  value = aws_rds_cluster.this.cluster_identifier
}

output "instance_id" {
  value = length(aws_rds_cluster_instance.this) > 0 ? aws_rds_cluster_instance.this[0].identifier : aws_rds_cluster.this.cluster_identifier
}

output "arn" {
  value = aws_rds_cluster.this.arn
}
