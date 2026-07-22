locals {
  workers_dev_account_subdomain = trimspace(var.workers_dev_account_subdomain)
  cv_public_route_pattern       = "${trimspace(var.cv_web_host)}/c/*"

  custom_domain_hostname = trimspace(var.worker_custom_domain_hostname)
  route_pattern          = trimspace(var.worker_route_pattern)
  custom_domain_enabled  = local.custom_domain_hostname != ""
  route_enabled          = local.route_pattern != ""
  route_connector_host   = trimsuffix(local.route_pattern, "/*")

  analytics_connector_workers_dev_url = var.enable_worker_dev_subdomain ? (
    "https://${var.worker_name}.${local.workers_dev_account_subdomain}.workers.dev"
  ) : null

  cv_public_workers_dev_url = var.enable_cv_public_worker_dev_subdomain ? (
    "https://${var.cv_public_worker_name}.${local.workers_dev_account_subdomain}.workers.dev"
  ) : null

  connector_url = (
    local.custom_domain_enabled ? "https://${local.custom_domain_hostname}" :
    local.route_enabled ? "https://${local.route_connector_host}" :
    local.analytics_connector_workers_dev_url
  )

  application_registry_api_url       = trimsuffix(trimspace(var.application_registry_api_url), "/")
  cv_public_resolver_url             = trimsuffix(trimspace(var.cv_public_resolver_url), "/")
  application_registry_access_domain = trimprefix(local.application_registry_api_url, "https://")
  cv_public_resolver_access_domain   = trimprefix(local.cv_public_resolver_url, "https://")

  application_registry_management_access_enabled = (
    trimspace(var.application_registry_management_access_email) != ""
  )
}
