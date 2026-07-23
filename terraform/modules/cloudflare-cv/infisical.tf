locals {
  infisical_metadata = {
    managed_by  = "terraform"
    module      = "terraform/modules/cloudflare-cv"
    environment = var.infisical_env_slug
    kind        = "terraform-output"
  }
}

resource "infisical_secret" "registry_api_url" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "REGISTRY_API_URL"
  value        = local.application_registry_api_url
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_application_registry_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Cloudflare Tunnel base URL for the self-hosted registry."
  })

  depends_on = [cloudflare_zero_trust_access_application.application_registry_management]
}

resource "infisical_secret" "facts_publication_registry_api_url" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "REGISTRY_API_URL"
  value        = local.application_registry_api_url
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_facts_publication_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Self-hosted registry endpoint used by facts publication."
  })
}
