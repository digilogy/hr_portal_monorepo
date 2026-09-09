# SES domain identity with automatic DKIM verification through Route 53.
# The aws provider passed to this module must be configured for the SES
# region; Route 53 is a global service so the same provider can create the
# DNS records.
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

data "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain
}

# Custom MAIL FROM domain (SPF alignment / deliverability)
resource "aws_sesv2_email_identity_mail_from_attributes" "this" {
  email_identity   = data.aws_sesv2_email_identity.domain.email_identity
  mail_from_domain = "${var.mail_from_subdomain}.${var.domain}"
}

data "aws_region" "current" {}

resource "aws_route53_record" "mail_from_mx" {
  zone_id         = var.route53_zone_id
  name            = "${var.mail_from_subdomain}.${var.domain}"
  type            = "MX"
  ttl             = 600
  records         = ["10 feedback-smtp.${data.aws_region.current.name}.amazonses.com"]
  allow_overwrite = true
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id         = var.route53_zone_id
  name            = "${var.mail_from_subdomain}.${var.domain}"
  type            = "TXT"
  ttl             = 600
  records         = ["v=spf1 include:amazonses.com ~all"]
  allow_overwrite = true
}

# DMARC: improves acceptance at strict receivers (Google/Microsoft tenants).
# p=none = monitor mode; tighten to quarantine/reject once reports look clean.
resource "aws_route53_record" "dmarc" {
  zone_id         = var.route53_zone_id
  name            = "_dmarc.${var.domain}"
  type            = "TXT"
  ttl             = 600
  records         = ["v=DMARC1; p=none; rua=mailto:${var.dmarc_report_email}; fo=1"]
  allow_overwrite = true
}

# ---------------------------------------------------------------------------
# Delivery tracking: configuration set publishes send/delivery/bounce events
# to SNS. Dormant by default (delivery_webhook_url = "") — main-zip has no
# SES bounce/complaint webhook route implemented yet, unlike
# ideas-staging-backend's /api/v1/webhooks/ses. The configuration set and
# SNS topic are still created so wiring a webhook up later is just an app
# change plus a var, not new infrastructure.
# ---------------------------------------------------------------------------
resource "aws_sesv2_configuration_set" "tracking" {
  configuration_set_name = "${var.name_prefix}-tracking"

  delivery_options {
    tls_policy = "REQUIRE"
  }

  tags = var.tags
}

resource "aws_sns_topic" "ses_events" {
  name = "${var.name_prefix}-ses-events"
  tags = var.tags
}

resource "aws_sesv2_configuration_set_event_destination" "sns" {
  configuration_set_name = aws_sesv2_configuration_set.tracking.configuration_set_name
  event_destination_name = "sns-delivery-events"

  event_destination {
    enabled              = true
    matching_event_types = ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT", "REJECT", "RENDERING_FAILURE"]

    sns_destination {
      topic_arn = aws_sns_topic.ses_events.arn
    }
  }
}

resource "aws_sns_topic_subscription" "webhook" {
  count = var.delivery_webhook_url != "" ? 1 : 0

  topic_arn              = aws_sns_topic.ses_events.arn
  protocol               = "https"
  endpoint               = var.delivery_webhook_url
  endpoint_auto_confirms = true
}
