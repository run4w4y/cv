output "connector_url" {
  description = "Public analytics connector base URL."
  value       = local.connector_url
}

output "workers_dev_urls" {
  description = "Cloudflare-provided workers.dev URLs enabled for the managed Workers."
  value = {
    analytics_connector  = local.analytics_connector_workers_dev_url
    application_registry = local.application_registry_workers_dev_url
  }
}

output "pages_project" {
  description = "Cloudflare Pages project managed for the public CV site."
  value = {
    name      = cloudflare_pages_project.cv.name
    subdomain = cloudflare_pages_project.cv.subdomain
  }
}

output "pages_domain" {
  description = "Cloudflare Pages custom domain and DNS record managed for the public CV site."
  value = {
    name          = cloudflare_pages_domain.cv.name
    project_name  = cloudflare_pages_domain.cv.project_name
    status        = cloudflare_pages_domain.cv.status
    dns_record_id = cloudflare_dns_record.cv_pages_domain.id
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
