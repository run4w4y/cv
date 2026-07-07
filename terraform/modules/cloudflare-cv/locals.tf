locals {
  custom_domain_hostname = trimspace(var.worker_custom_domain_hostname)
  route_pattern          = trimspace(var.worker_route_pattern)

  custom_domain_enabled = local.custom_domain_hostname != ""
  route_enabled         = local.route_pattern != ""

  route_connector_host = trimsuffix(local.route_pattern, "/*")

  connector_url = (
    local.custom_domain_enabled ? "https://${local.custom_domain_hostname}" :
    local.route_enabled ? "https://${local.route_connector_host}" :
    null
  )
}
