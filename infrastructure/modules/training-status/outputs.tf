output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "lambda_name" {
  value = aws_lambda_function.processing.function_name
}

output "raw_bucket_name" {
  value = aws_s3_bucket.raw.bucket
}

output "processed_bucket_name" {
  value = aws_s3_bucket.processed.bucket
}

output "web_bucket_name" {
  value = aws_s3_bucket.web.bucket
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}

output "strava_secret_arn" {
  value = aws_secretsmanager_secret.strava.arn
}
