removed {
  from = cloudflare_worker.analytics_connector

  lifecycle {
    destroy = false
  }
}

resource "cloudflare_workers_script_subdomain" "analytics_connector" {
  count = var.enable_worker_dev_subdomain ? 1 : 0

  account_id       = var.cloudflare_account_id
  script_name      = var.worker_name
  enabled          = true
  previews_enabled = false
}

resource "cloudflare_workers_custom_domain" "analytics_connector" {
  count = local.custom_domain_enabled ? 1 : 0

  account_id = var.cloudflare_account_id
  hostname   = local.custom_domain_hostname
  service    = var.worker_name
  zone_id    = var.cloudflare_zone_id
  zone_name  = var.zone_name
}

resource "cloudflare_workers_route" "analytics_connector" {
  count = local.route_enabled ? 1 : 0

  zone_id = var.cloudflare_zone_id
  pattern = local.route_pattern
  script  = var.worker_name
}

# Wrangler owns the cv-public Worker version. Terraform owns only its
# workers.dev exposure and the /c/* overlay on the frozen Pages hostname.
resource "cloudflare_workers_script_subdomain" "cv_public" {
  count = var.enable_cv_public_worker_dev_subdomain ? 1 : 0

  account_id       = var.cloudflare_account_id
  script_name      = var.cv_public_worker_name
  enabled          = true
  previews_enabled = false
}

moved {
  from = cloudflare_workers_route.cv_public
  to   = cloudflare_workers_route.cv_public[0]
}

resource "cloudflare_workers_route" "cv_public" {
  count = var.enable_cv_public_route_overlay ? 1 : 0

  zone_id = var.cloudflare_zone_id
  pattern = local.cv_public_route_pattern
  script  = var.cv_public_worker_name
}
