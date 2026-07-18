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

resource "cloudflare_d1_database" "application_registry" {
  account_id = var.cloudflare_account_id
  name       = var.application_registry_database_name

  read_replication = {
    mode = "disabled"
  }

  primary_location_hint = (
    trimspace(var.application_registry_database_primary_location_hint) != "" ?
    trimspace(var.application_registry_database_primary_location_hint) :
    null
  )

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_script_subdomain" "application_registry" {
  count = var.enable_application_registry_worker_dev_subdomain ? 1 : 0

  account_id       = var.cloudflare_account_id
  script_name      = var.application_registry_worker_name
  enabled          = true
  previews_enabled = false

  # The management SPA's same-origin BFF injects the registry bearer token.
  # Attach both Access applications before making that hostname reachable.
  depends_on = [
    cloudflare_zero_trust_access_application.application_registry_machine_api,
    cloudflare_zero_trust_access_application.application_registry_management,
  ]

  lifecycle {
    precondition {
      condition     = local.application_registry_management_access_enabled
      error_message = "application_registry_management_access_email must be set before exposing the registry on workers.dev."
    }
  }
}

resource "cloudflare_workers_custom_domain" "application_registry" {
  count = local.application_registry_custom_domain_enabled ? 1 : 0

  account_id = var.cloudflare_account_id
  hostname   = local.application_registry_custom_domain_hostname
  service    = var.application_registry_worker_name
  zone_id    = var.cloudflare_zone_id
  zone_name  = var.zone_name
}

resource "cloudflare_workers_route" "application_registry" {
  count = local.application_registry_route_enabled ? 1 : 0

  zone_id = var.cloudflare_zone_id
  pattern = local.application_registry_route_pattern
  script  = var.application_registry_worker_name
}

# Wrangler owns the cv-public Worker version and its one-way named registry
# service binding. Terraform owns only its workers.dev exposure and the exact
# path overlay on the frozen Pages hostname.
resource "cloudflare_workers_script_subdomain" "cv_public" {
  count = var.enable_cv_public_worker_dev_subdomain ? 1 : 0

  account_id       = var.cloudflare_account_id
  script_name      = var.cv_public_worker_name
  enabled          = true
  previews_enabled = false
}

# Preserve the existing route instance when introducing the bootstrap gate.
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
