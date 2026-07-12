locals {
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

  connector_url = (
    local.custom_domain_enabled ? "https://${local.custom_domain_hostname}" :
    local.route_enabled ? "https://${local.route_connector_host}" :
    null
  )

  application_registry_api_url = (
    local.application_registry_custom_domain_enabled ? "https://${local.application_registry_custom_domain_hostname}" :
    local.application_registry_route_enabled ? "https://${local.application_registry_route_host}" :
    null
  )
}
