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
    description = "Public base URL for the retained analytics connector Worker."
  })

  depends_on = [
    cloudflare_workers_script_subdomain.analytics_connector,
    cloudflare_workers_custom_domain.analytics_connector,
    cloudflare_workers_route.analytics_connector,
  ]
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

resource "infisical_secret" "cv_public_worker_name" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "CV_PUBLIC_WORKER_NAME"
  value        = var.cv_public_worker_name
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_cv_public_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Public SSR CV Worker name used by Wrangler deployments."
  })
}

resource "infisical_secret" "cv_public_resolver_url" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "CV_PUBLIC_RESOLVER_URL"
  value        = local.cv_public_resolver_url
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_cv_public_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Tunnel origin used by the public CV Worker for publication resolution."
  })

  depends_on = [cloudflare_zero_trust_access_application.application_registry_public_resolver]
}

resource "infisical_secret" "cv_public_route_pattern" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "CV_PUBLIC_ROUTE_PATTERN"
  value        = local.cv_public_route_pattern
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_cv_public_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Terraform-owned path overlay that sends /c/* to cv-public."
  })

  depends_on = [cloudflare_workers_route.cv_public]
}
