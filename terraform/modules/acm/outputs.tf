output "certificate_arn" {
  description = "Validated certificate ARN (safe to attach to the ALB)"
  value       = aws_acm_certificate_validation.this.certificate_arn
}
