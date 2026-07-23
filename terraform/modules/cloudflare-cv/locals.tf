locals {
  application_registry_api_url       = trimsuffix(trimspace(var.application_registry_api_url), "/")
  application_registry_access_domain = trimprefix(local.application_registry_api_url, "https://")

  application_registry_management_access_enabled = (
    trimspace(var.application_registry_management_access_email) != ""
  )
}
