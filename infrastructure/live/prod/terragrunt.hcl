include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../modules/training-status"
}

inputs = {
  aws_region          = "eu-west-1"
  environment         = "prod"
  raw_bucket_name     = "training-status-raw-prod-126652441520"
  processed_bucket_name = "training-status-processed-prod-126652441520"
  web_bucket_name     = "training-status-web-prod-126652441520"
  web_source_dir      = "${get_repo_root()}/apps/web/public"
  lambda_artifact_dir = "${get_repo_root()}/build/lambda"
  schedule_expression = "rate(1 minute)"
  athlete_name        = "Athlete"
  ftp                 = 300
  threshold_heart_rate = 170
  run_threshold_pace  = 4.8
    github_repository   = get_env("GITHUB_REPOSITORY", "onekrasov/training-status")
}
