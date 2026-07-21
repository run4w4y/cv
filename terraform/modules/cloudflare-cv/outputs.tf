output "connector_url" {
  description = "Public analytics connector base URL."
  value       = local.connector_url
}

output "workers_dev_urls" {
  description = "Cloudflare-provided URLs enabled for the retained Workers."
  value = {
    analytics_connector = local.analytics_connector_workers_dev_url
    cv_public           = local.cv_public_workers_dev_url
  }
}

output "worker_name" {
  description = "Analytics connector Worker script name."
  value       = var.worker_name
}

output "worker_custom_domain_hostname" {
  description = "Configured analytics Worker Custom Domain hostname, if any."
  value       = local.custom_domain_enabled ? local.custom_domain_hostname : null
}

output "worker_route_pattern" {
  description = "Configured analytics Worker route pattern, if any."
  value       = local.route_enabled ? local.route_pattern : null
}

output "application_registry" {
  description = "Self-hosted registry endpoint protected by Cloudflare Access."
  value = {
    api_url             = local.application_registry_api_url
    public_resolver_url = local.cv_public_resolver_url
  }
}

output "cv_public" {
  description = "Public SSR CV Worker deployment and route-overlay values."
  value = {
    resolver_url          = local.cv_public_resolver_url
    route_overlay_enabled = var.enable_cv_public_route_overlay
    route_pattern         = var.enable_cv_public_route_overlay ? local.cv_public_route_pattern : null
    worker_name           = var.cv_public_worker_name
    workers_dev_enabled   = var.enable_cv_public_worker_dev_subdomain
    workers_dev_url       = local.cv_public_workers_dev_url
  }
}
