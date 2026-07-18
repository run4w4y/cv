resource "cloudflare_r2_bucket" "cv_objects" {
  account_id = var.cloudflare_account_id
  name       = var.cv_objects_bucket_name
  location   = var.cv_objects_bucket_location

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_kv_namespace" "chatgpt_sessions" {
  account_id = var.cloudflare_account_id
  title      = var.chatgpt_sessions_namespace_title
}
