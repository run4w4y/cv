output "connector_url" {
  description = "Public connector base URL when a custom domain or route was configured."
  value       = local.connector_url
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
  value       = cloudflare_worker.analytics_connector.name
}

output "worker_custom_domain_hostname" {
  description = "Configured Worker Custom Domain hostname, if any."
  value       = local.custom_domain_enabled ? local.custom_domain_hostname : null
}

output "worker_route_pattern" {
  description = "Configured Worker route pattern, if any."
  value       = local.route_enabled ? local.route_pattern : null
}
