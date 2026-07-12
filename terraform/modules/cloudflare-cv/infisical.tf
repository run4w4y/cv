locals {
  infisical_metadata = {
    managed_by  = "terraform"
    module      = "terraform/modules/cloudflare-cv"
    environment = var.infisical_env_slug
    kind        = "terraform-output"
  }
}

resource "infisical_secret" "analytics_connector_url" {
  count = var.infisical_sync_enabled && local.connector_url != null ? 1 : 0

  name         = "ANALYTICS_CONNECTOR_URL"
  value        = local.connector_url
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_analytics_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Public base URL for the analytics connector Worker."
  })

  depends_on = [
    cloudflare_workers_script_subdomain.analytics_connector,
    cloudflare_workers_custom_domain.analytics_connector,
    cloudflare_workers_route.analytics_connector,
  ]
}

resource "infisical_secret" "registry_api_url" {
  count = var.infisical_sync_enabled && local.application_registry_api_url != null ? 1 : 0

  name         = "REGISTRY_API_URL"
  value        = local.application_registry_api_url
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_application_registry_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Public base URL for the application registry Worker."
  })

  depends_on = [
    cloudflare_workers_script_subdomain.application_registry,
    cloudflare_workers_custom_domain.application_registry,
    cloudflare_workers_route.application_registry,
  ]
}

resource "infisical_secret" "application_registry_database_id" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "APPLICATION_REGISTRY_DB_ID"
  value        = cloudflare_d1_database.application_registry.id
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_application_registry_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Cloudflare D1 database ID injected into the production Wrangler configuration."
  })
}

resource "infisical_secret" "application_registry_database_name" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "APPLICATION_REGISTRY_DB_NAME"
  value        = cloudflare_d1_database.application_registry.name
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_application_registry_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Cloudflare D1 database name used by registry deployment and migration commands."
  })
}

resource "infisical_secret" "application_registry_worker_name" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "APPLICATION_REGISTRY_WORKER_NAME"
  value        = var.application_registry_worker_name
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_application_registry_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Application registry Worker name used by Wrangler deployments."
  })
}
