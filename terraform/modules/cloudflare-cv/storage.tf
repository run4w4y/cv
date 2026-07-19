resource "cloudflare_r2_bucket" "cv_objects" {
  account_id = var.cloudflare_account_id
  name       = var.cv_objects_bucket_name
  location   = var.cv_objects_bucket_location

  lifecycle {
    prevent_destroy = true
  }
}

# Reviewed facts are deliberately isolated from the registry's general object
# store. The bucket has no r2.dev endpoint, custom domain, or Worker binding;
# consumers use its S3 endpoint with bucket-scoped credentials.
resource "cloudflare_r2_bucket" "cv_facts" {
  account_id = var.cloudflare_account_id
  name       = var.facts_r2_bucket_name
  location   = var.facts_r2_bucket_location

  lifecycle {
    prevent_destroy = true
  }
}

data "cloudflare_account_api_token_permission_groups_list" "facts_r2_read" {
  account_id = var.cloudflare_account_id
  name       = "Workers R2 Storage Bucket Item Read"
}

data "cloudflare_account_api_token_permission_groups_list" "facts_r2_write" {
  account_id = var.cloudflare_account_id
  name       = "Workers R2 Storage Bucket Item Write"
}

locals {
  facts_r2_bucket_resource = "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.cv_facts.name}"
}

resource "cloudflare_account_token" "facts_r2_reader" {
  account_id = var.cloudflare_account_id
  name       = "cv-facts-object-reader"
  policies = [{
    effect = "allow"
    permission_groups = [{
      id = data.cloudflare_account_api_token_permission_groups_list.facts_r2_read.result[0].id
    }]
    resources = jsonencode({
      (local.facts_r2_bucket_resource) = "*"
    })
  }]

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_account_token" "facts_r2_publisher" {
  account_id = var.cloudflare_account_id
  name       = "cv-facts-object-publisher"
  policies = [{
    effect = "allow"
    permission_groups = [
      {
        id = data.cloudflare_account_api_token_permission_groups_list.facts_r2_read.result[0].id
      },
      {
        id = data.cloudflare_account_api_token_permission_groups_list.facts_r2_write.result[0].id
      },
    ]
    resources = jsonencode({
      (local.facts_r2_bucket_resource) = "*"
    })
  }]

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_kv_namespace" "chatgpt_sessions" {
  account_id = var.cloudflare_account_id
  title      = var.chatgpt_sessions_namespace_title
}
