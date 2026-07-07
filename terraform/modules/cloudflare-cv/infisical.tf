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
    cloudflare_workers_custom_domain.analytics_connector,
    cloudflare_workers_route.analytics_connector,
  ]
}
