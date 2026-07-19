locals {
  infisical_metadata = {
    managed_by  = "terraform"
    module      = "terraform/modules/cloudflare-cv"
    environment = var.infisical_env_slug
    kind        = "terraform-output"
  }
}

locals {
  facts_r2_infisical_values = {
    FACTS_R2_ACCESS_KEY_ID = {
      description = "Bucket-scoped Object Read & Write access key used only by the reviewed-facts publisher."
      value       = cloudflare_account_token.facts_r2_publisher.id
    }
    FACTS_R2_ACCOUNT_ID = {
      description = "Cloudflare account ID used to construct the reviewed-facts S3 endpoint."
      value       = var.cloudflare_account_id
    }
    FACTS_R2_BUCKET = {
      description = "Private R2 bucket containing immutable reviewed-facts releases."
      value       = cloudflare_r2_bucket.cv_facts.name
    }
    FACTS_R2_SECRET_ACCESS_KEY = {
      description = "Bucket-scoped Object Read & Write secret used only by the reviewed-facts publisher."
      value       = sha256(cloudflare_account_token.facts_r2_publisher.value)
    }
    VITE_FACTS_R2_ACCESS_KEY_ID = {
      description = "Bucket-scoped Object Read access key embedded in the private management application."
      value       = cloudflare_account_token.facts_r2_reader.id
    }
    VITE_FACTS_R2_ACCOUNT_ID = {
      description = "Cloudflare account ID embedded in the management application for direct facts reads."
      value       = var.cloudflare_account_id
    }
    VITE_FACTS_R2_BUCKET = {
      description = "Private reviewed-facts bucket embedded in the management application."
      value       = cloudflare_r2_bucket.cv_facts.name
    }
    VITE_FACTS_R2_SECRET_ACCESS_KEY = {
      description = "Bucket-scoped Object Read secret embedded in the private management application."
      value       = sha256(cloudflare_account_token.facts_r2_reader.value)
    }
  }
}

resource "infisical_secret" "facts_r2" {
  for_each = var.infisical_sync_enabled ? toset([
    "FACTS_R2_ACCESS_KEY_ID",
    "FACTS_R2_ACCOUNT_ID",
    "FACTS_R2_BUCKET",
    "FACTS_R2_SECRET_ACCESS_KEY",
    "VITE_FACTS_R2_ACCESS_KEY_ID",
    "VITE_FACTS_R2_ACCOUNT_ID",
    "VITE_FACTS_R2_BUCKET",
    "VITE_FACTS_R2_SECRET_ACCESS_KEY",
  ]) : toset([])

  name         = each.value
  value        = local.facts_r2_infisical_values[each.value].value
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_content_folder_path

  metadata = merge(local.infisical_metadata, {
    description = local.facts_r2_infisical_values[each.value].description
  })
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

resource "infisical_secret" "application_registry_workers_dev_enabled" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "APPLICATION_REGISTRY_WORKERS_DEV_ENABLED"
  value        = tostring(var.enable_application_registry_worker_dev_subdomain)
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_application_registry_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Terraform-synced flag that lets later Wrangler deploys preserve the Access-protected registry workers.dev endpoint."
  })

  # This flag is deliberately unavailable during the targeted storage
  # bootstrap. It becomes true only after Access exists and Terraform has
  # safely enabled the registry hostname.
  depends_on = [
    cloudflare_workers_script_subdomain.application_registry,
    cloudflare_zero_trust_access_application.application_registry_machine_api,
    cloudflare_zero_trust_access_application.application_registry_management,
  ]
}

resource "infisical_secret" "cv_objects_bucket_name" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "CV_OBJECTS_BUCKET_NAME"
  value        = cloudflare_r2_bucket.cv_objects.name
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_application_registry_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Private R2 bucket bound to the application registry Worker as CV_OBJECTS."
  })
}

resource "infisical_secret" "chatgpt_sessions_namespace_id" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "CHATGPT_SESSIONS_KV_ID"
  value        = cloudflare_workers_kv_namespace.chatgpt_sessions.id
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_application_registry_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Workers KV namespace bound to the registry Worker as CHATGPT_SESSIONS."
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

resource "infisical_secret" "cv_public_registry_service_name" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "CV_PUBLIC_REGISTRY_SERVICE_NAME"
  value        = var.application_registry_worker_name
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_cv_public_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Registry Worker service name bound to the public CV Worker."
  })
}

resource "infisical_secret" "cv_public_resolver_entrypoint" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "CV_PUBLIC_RESOLVER_ENTRYPOINT"
  value        = var.cv_public_resolver_entrypoint
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_cv_public_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Named registry entrypoint bound to the public CV Worker."
  })
}

resource "infisical_secret" "cv_public_route_pattern" {
  count = var.infisical_sync_enabled ? 1 : 0

  name         = "CV_PUBLIC_ROUTE_PATTERN"
  value        = local.cv_public_route_pattern
  env_slug     = var.infisical_env_slug
  workspace_id = var.infisical_project_id
  folder_path  = var.infisical_cv_public_folder_path

  metadata = merge(local.infisical_metadata, {
    description = "Terraform-owned path overlay that sends public CV token routes to cv-public."
  })

  depends_on = [cloudflare_workers_route.cv_public]
}
