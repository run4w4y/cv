resource "cloudflare_zero_trust_access_application" "application_registry_management" {
  count = local.application_registry_management_access_enabled ? 1 : 0

  account_id                 = var.cloudflare_account_id
  name                       = "CV application registry management"
  domain                     = local.application_registry_web_domain
  type                       = "self_hosted"
  app_launcher_visible       = false
  enable_binding_cookie      = true
  http_only_cookie_attribute = true
  session_duration           = "720h"

  policies = [{
    decision   = "allow"
    name       = "Allow the registry owner"
    precedence = 1
    include = [{
      email = {
        email = trimspace(var.application_registry_management_access_email)
      }
    }]
  }]
}
