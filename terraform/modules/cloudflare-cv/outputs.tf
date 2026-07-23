output "application_registry" {
  description = "Self-hosted registry web and API endpoints."
  value = {
    api_url = local.application_registry_api_url
    web_url = local.application_registry_web_url
  }
}

output "cv_web" {
  description = "Public CV hostname and cache-rule identity."
  value = {
    host             = var.cv_web_host
    cache_ruleset_id = cloudflare_ruleset.cv_public_cache.id
  }
}
