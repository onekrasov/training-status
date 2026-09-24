terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "training_data" {
  bucket = var.training_data_bucket_name
}

resource "aws_s3_bucket" "web" {
  bucket = var.web_bucket_name
}

resource "aws_s3_bucket_website_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  depends_on = [aws_s3_bucket_public_access_block.web]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowPublicRead"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = "${aws_s3_bucket.web.arn}/*"
      }
    ]
  })
}

resource "aws_s3_object" "web_index" {
  bucket       = aws_s3_bucket.web.id
  key          = "index.html"
  source       = var.web_index_path
  etag         = filemd5(var.web_index_path)
  content_type = "text/html"
}

resource "aws_iam_role" "lambda" {
  name = "training-status-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "training-status-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.training_data.arn,
          "${aws_s3_bucket.training_data.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.web.arn}/readiness/*"
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "training_status" {
  function_name    = "training-status-sync"
  filename         = var.lambda_package_path
  source_code_hash = filebase64sha256(var.lambda_package_path)
  handler          = "dist/src/module1/handler.handler"
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  timeout          = 60

  environment {
    variables = {
      TRAINING_BUCKET                          = aws_s3_bucket.training_data.id
      TRAINING_PREFIX                          = var.training_data_prefix
      PUBLIC_READINESS_BUCKET                  = aws_s3_bucket.web.id
      PUBLIC_READINESS_PREFIX                  = "readiness"
      STRAVA_CLIENT_ID                         = var.strava_client_id
      STRAVA_CLIENT_SECRET                     = var.strava_client_secret
      STRAVA_REFRESH_TOKEN                     = var.strava_refresh_token
      STRAVA_PACE_THRESHOLD_METERS_PER_SECOND  = tostring(var.pace_threshold_meters_per_second)
    }
  }
}

resource "aws_cloudwatch_event_rule" "every_minute" {
  name                = "training-status-every-minute"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "lambda" {
  arn  = aws_lambda_function.training_status.arn
  rule = aws_cloudwatch_event_rule.every_minute.name
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.training_status.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_minute.arn
  statement_id  = "AllowExecutionFromCloudWatch"
}
