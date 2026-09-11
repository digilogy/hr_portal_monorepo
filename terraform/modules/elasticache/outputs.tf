output "primary_endpoint" {
  value = aws_elasticache_serverless_cache.this.endpoint[0].address
}

output "port" {
  value = aws_elasticache_serverless_cache.this.endpoint[0].port
}

output "serverless_cache_name" {
  value = aws_elasticache_serverless_cache.this.name
}

output "arn" {
  value = aws_elasticache_serverless_cache.this.arn
}

output "reader_endpoint" {
  value = try(aws_elasticache_serverless_cache.this.reader_endpoint[0].address, aws_elasticache_serverless_cache.this.endpoint[0].address)
}
