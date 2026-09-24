variable "aws_region" {
  type = string
}

variable "environment" {
  type = string
}

variable "raw_bucket_name" {
  type = string
}

variable "processed_bucket_name" {
  type = string
}

variable "web_bucket_name" {
  type = string
}

variable "web_source_dir" {
  type = string
}

variable "lambda_artifact_dir" {
  type = string
}

variable "schedule_expression" {
  type    = string
  default = "rate(1 minute)"
}

variable "athlete_name" {
  type = string
}

variable "ftp" {
  type = number
}

variable "threshold_heart_rate" {
  type = number
}

variable "run_threshold_pace" {
  type = number
}

variable "github_repository" {
  type        = string
  description = "GitHub owner/repository allowed to assume the deployment role."
}
