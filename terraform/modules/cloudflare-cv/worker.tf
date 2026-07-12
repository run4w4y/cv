resource "cloudflare_worker" "analytics_connector" {
  account_id = var.cloudflare_account_id
  name       = var.worker_name

  subdomain = var.enable_worker_dev_subdomain ? {
    enabled          = true
    previews_enabled = false
  } : null
}

resource "cloudflare_workers_custom_domain" "analytics_connector" {
  count = local.custom_domain_enabled ? 1 : 0

  account_id = var.cloudflare_account_id
  hostname   = local.custom_domain_hostname
  service    = cloudflare_worker.analytics_connector.name
  zone_id    = var.cloudflare_zone_id
  zone_name  = var.zone_name

  depends_on = [cloudflare_worker.analytics_connector]
}

resource "cloudflare_workers_route" "analytics_connector" {
  count = local.route_enabled ? 1 : 0

  zone_id = var.cloudflare_zone_id
  pattern = local.route_pattern
  script  = cloudflare_worker.analytics_connector.name

  depends_on = [cloudflare_worker.analytics_connector]
}

resource "cloudflare_d1_database" "application_registry" {
  account_id = var.cloudflare_account_id
  name       = var.application_registry_database_name

  primary_location_hint = (
    trimspace(var.application_registry_database_primary_location_hint) != "" ?
    trimspace(var.application_registry_database_primary_location_hint) :
    null
  )

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_worker" "application_registry" {
  account_id = var.cloudflare_account_id
  name       = var.application_registry_worker_name

  subdomain = var.enable_application_registry_worker_dev_subdomain ? {
    enabled          = true
    previews_enabled = false
  } : null
}

resource "cloudflare_workers_custom_domain" "application_registry" {
  count = local.application_registry_custom_domain_enabled ? 1 : 0

  account_id = var.cloudflare_account_id
  hostname   = local.application_registry_custom_domain_hostname
  service    = cloudflare_worker.application_registry.name
  zone_id    = var.cloudflare_zone_id
  zone_name  = var.zone_name

  depends_on = [cloudflare_worker.application_registry]
}

resource "cloudflare_workers_route" "application_registry" {
  count = local.application_registry_route_enabled ? 1 : 0

  zone_id = var.cloudflare_zone_id
  pattern = local.application_registry_route_pattern
  script  = cloudflare_worker.application_registry.name

  depends_on = [cloudflare_worker.application_registry]
}
