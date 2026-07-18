locals {
  workers_dev_account_subdomain = trimspace(var.workers_dev_account_subdomain)

  cv_public_route_pattern = "${trimspace(var.cv_web_host)}/c/*"

  custom_domain_hostname = trimspace(var.worker_custom_domain_hostname)
  route_pattern          = trimspace(var.worker_route_pattern)

  application_registry_custom_domain_hostname = trimspace(var.application_registry_worker_custom_domain_hostname)
  application_registry_route_pattern          = trimspace(var.application_registry_worker_route_pattern)

  custom_domain_enabled = local.custom_domain_hostname != ""
  route_enabled         = local.route_pattern != ""

  application_registry_custom_domain_enabled = local.application_registry_custom_domain_hostname != ""
  application_registry_route_enabled         = local.application_registry_route_pattern != ""

  route_connector_host            = trimsuffix(local.route_pattern, "/*")
  application_registry_route_host = trimsuffix(local.application_registry_route_pattern, "/*")

  analytics_connector_workers_dev_url = var.enable_worker_dev_subdomain ? (
    "https://${var.worker_name}.${local.workers_dev_account_subdomain}.workers.dev"
  ) : null

  application_registry_workers_dev_url = var.enable_application_registry_worker_dev_subdomain ? (
    "https://${var.application_registry_worker_name}.${local.workers_dev_account_subdomain}.workers.dev"
  ) : null

  cv_public_workers_dev_url = var.enable_cv_public_worker_dev_subdomain ? (
    "https://${var.cv_public_worker_name}.${local.workers_dev_account_subdomain}.workers.dev"
  ) : null

  connector_url = (
    local.custom_domain_enabled ? "https://${local.custom_domain_hostname}" :
    local.route_enabled ? "https://${local.route_connector_host}" :
    local.analytics_connector_workers_dev_url
  )

  application_registry_api_url = (
    local.application_registry_custom_domain_enabled ? "https://${local.application_registry_custom_domain_hostname}" :
    local.application_registry_route_enabled ? "https://${local.application_registry_route_host}" :
    local.application_registry_workers_dev_url
  )

  application_registry_access_domain = (
    local.application_registry_api_url == null ? null :
    trimprefix(local.application_registry_api_url, "https://")
  )

  application_registry_management_access_enabled = (
    trimspace(var.application_registry_management_access_email) != "" &&
    local.application_registry_access_domain != null
  )
}
