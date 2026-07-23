locals {
  application_registry_api_url    = trimsuffix(trimspace(var.application_registry_api_url), "/")
  application_registry_web_url    = trimsuffix(trimspace(var.application_registry_web_url), "/")
  application_registry_web_domain = trimprefix(local.application_registry_web_url, "https://")

  application_registry_management_access_enabled = (
    trimspace(var.application_registry_management_access_email) != ""
  )
}
