output "connector_url" {
  description = "Public analytics connector base URL."
  value       = local.connector_url
}

output "workers_dev_urls" {
  description = "Cloudflare-provided workers.dev URLs enabled for the managed Workers."
  value = {
    analytics_connector  = local.analytics_connector_workers_dev_url
    application_registry = local.application_registry_workers_dev_url
    cv_public            = local.cv_public_workers_dev_url
  }
}

output "worker_name" {
  description = "Analytics connector Worker script name."
  value       = var.worker_name
}

output "worker_custom_domain_hostname" {
  description = "Configured Worker Custom Domain hostname, if any."
  value       = local.custom_domain_enabled ? local.custom_domain_hostname : null
}

output "worker_route_pattern" {
  description = "Configured Worker route pattern, if any."
  value       = local.route_enabled ? local.route_pattern : null
}

output "application_registry" {
  description = "Application registry Worker and D1 deployment values used by Wrangler and registry clients."
  value = {
    api_url             = local.application_registry_api_url
    database_binding    = "APPLICATION_REGISTRY_DB"
    database_id         = cloudflare_d1_database.application_registry.id
    database_name       = cloudflare_d1_database.application_registry.name
    worker_name         = var.application_registry_worker_name
    custom_domain       = local.application_registry_custom_domain_enabled ? local.application_registry_custom_domain_hostname : null
    route_pattern       = local.application_registry_route_enabled ? local.application_registry_route_pattern : null
    workers_dev_enabled = var.enable_application_registry_worker_dev_subdomain
    workers_dev_url     = local.application_registry_workers_dev_url
  }
}

output "cv_objects" {
  description = "Private R2 object bucket used by the v2 registry Worker."
  value = {
    binding  = "CV_OBJECTS"
    id       = cloudflare_r2_bucket.cv_objects.id
    location = cloudflare_r2_bucket.cv_objects.location
    name     = cloudflare_r2_bucket.cv_objects.name
  }
}

output "facts_r2" {
  description = "Private reviewed-facts R2 bucket and its scoped S3 credential identifiers."
  value = {
    account_id              = var.cloudflare_account_id
    bucket_id               = cloudflare_r2_bucket.cv_facts.id
    bucket_location         = cloudflare_r2_bucket.cv_facts.location
    bucket_name             = cloudflare_r2_bucket.cv_facts.name
    endpoint                = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
    publisher_access_key_id = cloudflare_account_token.facts_r2_publisher.id
    reader_access_key_id    = cloudflare_account_token.facts_r2_reader.id
  }
}

output "chatgpt_sessions" {
  description = "Workers KV namespace used by the registry Worker for subscription authentication sessions."
  value = {
    binding = "CHATGPT_SESSIONS"
    id      = cloudflare_workers_kv_namespace.chatgpt_sessions.id
    title   = cloudflare_workers_kv_namespace.chatgpt_sessions.title
  }
}

output "cv_public" {
  description = "Public SSR CV Worker deployment and route-overlay values."
  value = {
    registry_entrypoint   = var.cv_public_resolver_entrypoint
    registry_service      = var.application_registry_worker_name
    resolver_binding      = "CV_PUBLIC_RESOLVER"
    route_overlay_enabled = var.enable_cv_public_route_overlay
    route_pattern         = var.enable_cv_public_route_overlay ? local.cv_public_route_pattern : null
    worker_name           = var.cv_public_worker_name
    workers_dev_enabled   = var.enable_cv_public_worker_dev_subdomain
    workers_dev_url       = local.cv_public_workers_dev_url
  }
}
