variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "training_data_bucket_name" {
  type = string
}

variable "web_bucket_name" {
  type = string
}

variable "training_data_prefix" {
  type    = string
  default = ""
}

variable "lambda_package_path" {
  type = string
}

variable "web_index_path" {
  type    = string
  default = "../web/index.html"
}

variable "strava_client_id" {
  type      = string
  sensitive = true
}

variable "strava_client_secret" {
  type      = string
  sensitive = true
}

variable "strava_refresh_token" {
  type      = string
  sensitive = true
}

variable "pace_threshold_meters_per_second" {
  type    = number
  default = 0
}
