output "identity_arn" {
  value = data.aws_sesv2_email_identity.domain.arn
}

output "domain" {
  value = data.aws_sesv2_email_identity.domain.email_identity
}

output "configuration_set_name" {
  value = aws_sesv2_configuration_set.tracking.configuration_set_name
}

output "events_topic_name" {
  value = aws_sns_topic.ses_events.name
}
