resource "cloudflare_zero_trust_access_application" "application_registry_management" {
  count = local.application_registry_management_access_enabled ? 1 : 0

  account_id                 = var.cloudflare_account_id
  name                       = "CV application registry management"
  domain                     = local.application_registry_access_domain
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

# Publication and preview tokens are capability URLs. The public CV Worker
# resolves them through the Tunnel without holding an Access service token.
resource "cloudflare_zero_trust_access_application" "application_registry_public_resolver" {
  count = local.application_registry_management_access_enabled ? 1 : 0

  account_id           = var.cloudflare_account_id
  name                 = "CV public publication resolver"
  domain               = "${local.cv_public_resolver_access_domain}/cv-*"
  type                 = "self_hosted"
  app_launcher_visible = false
  session_duration     = "24h"

  policies = [{
    decision   = "bypass"
    name       = "Allow capability-token resolution"
    precedence = 1
    include = [{
      everyone = {}
    }]
  }]
}

# Facts publication and other automation already authenticate with the
# registry's bearer token. A more-specific Access application keeps that
# machine API available without turning the browser-facing BFF into a public
# bearer-token proxy.
resource "cloudflare_zero_trust_access_application" "application_registry_machine_api" {
  count = local.application_registry_management_access_enabled ? 1 : 0

  account_id           = var.cloudflare_account_id
  name                 = "CV application registry machine API"
  domain               = "${local.application_registry_access_domain}/machine/*"
  type                 = "self_hosted"
  app_launcher_visible = false
  session_duration     = "720h"

  policies = [{
    decision   = "bypass"
    name       = "Use the registry bearer token"
    precedence = 1
    include = [{
      everyone = {}
    }]
  }]
}
