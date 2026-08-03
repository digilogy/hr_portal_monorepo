# Static frontend hosting: private S3 bucket behind CloudFront with OAC.
# CloudFront requires its ACM certificate in us-east-1 (aws.use1 provider).
#
# Unlike ideas-staging-backend's "web" frontend module, hr_portal is not a
# same-origin SPA proxying /api/* through CloudFront to the ALB — it calls
# the API at an absolute NEXT_PUBLIC_API_URL (see apps/hr_portal/src/lib/api.ts),
# baked in at build time. So this module is plain static hosting: one S3
# origin, one default cache behavior, no API path routing.
#
# Deploy the frontend by syncing the static export to the bucket:
#   aws s3 sync apps/hr_portal/out/ s3://<bucket>/ --delete
#   aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.use1]
    }
  }
}

# ---------------------------------------------------------------------------
# Bucket (private — only CloudFront can read)
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "frontend" {
  bucket = var.bucket_name
  tags   = merge(var.tags, { Name = var.bucket_name })
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Placeholder page served until the real frontend build is synced
resource "aws_s3_object" "placeholder" {
  bucket       = aws_s3_bucket.frontend.id
  key          = "index.html"
  content_type = "text/html; charset=utf-8"

  content = <<-HTML
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>HR Portal</title>
      <style>
        body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0f172a;color:#e2e8f0}
        main{text-align:center;padding:2rem}
        h1{font-weight:600}
        p{color:#94a3b8}
      </style>
    </head>
    <body>
      <main>
        <h1>HR Portal</h1>
        <p>The frontend has not been deployed yet. Sync your build to the frontend S3 bucket to go live.</p>
      </main>
    </body>
    </html>
  HTML

  lifecycle {
    # Do not fight a real frontend deployment that overwrites index.html
    ignore_changes = [content, etag, content_type]
  }
}

# ---------------------------------------------------------------------------
# Certificate (must be us-east-1 for CloudFront)
# ---------------------------------------------------------------------------
resource "aws_acm_certificate" "frontend" {
  provider = aws.use1

  domain_name       = var.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, { Name = var.domain })
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.frontend.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "frontend" {
  provider = aws.use1

  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# ---------------------------------------------------------------------------
# CloudFront
# ---------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.name_prefix}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name_prefix} frontend (${var.domain})"
  default_root_object = "index.html"
  aliases             = [var.domain]
  price_class         = "PriceClass_200" # includes India edge locations

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    # AWS managed CachingOptimized policy
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # Next.js static export serves its own 404.html; forward 404s there
  # instead of CloudFront's default XML error page.
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.frontend.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-frontend" })
}

# Only this distribution may read the bucket
resource "aws_s3_bucket_policy" "frontend" {
  bucket     = aws_s3_bucket.frontend.id
  depends_on = [aws_s3_bucket_public_access_block.frontend]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn }
        }
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# DNS: apex A/AAAA aliases to CloudFront
# ---------------------------------------------------------------------------
resource "aws_route53_record" "apex_a" {
  zone_id = var.route53_zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "apex_aaaa" {
  zone_id = var.route53_zone_id
  name    = var.domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}
