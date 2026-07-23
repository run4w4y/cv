locals {
  root_path                 = "/${var.root_folder_name}"
  analytics_path            = "${local.root_path}/analytics"
  application_registry_path = "${local.root_path}/application-registry"
  content_path              = "${local.root_path}/content"
  deploy_path               = "${local.root_path}/deploy"
  facts_publication_path    = "${local.root_path}/facts-publication"

  placeholder_value = "TODO_FILL_ME"

  common_metadata = {
    managed_by  = "terraform"
    module      = "terraform/modules/infisical-cv"
    environment = var.environment_slug
  }

  child_folders = {
    analytics = {
      name        = "analytics"
      path        = local.analytics_path
      description = "Cloudflare GraphQL analytics credentials consumed by the self-hosted registry API."
    }
    application_registry = {
      name        = "application-registry"
      path        = local.application_registry_path
      description = "Personal application registry authentication and Cloudflare deployment values."
    }
    content = {
      name        = "content"
      path        = local.content_path
      description = "Private CV content credentials."
    }
    deploy = {
      name        = "deploy"
      path        = local.deploy_path
      description = "Cloudflare account, zone, Access, and cache-rule deployment settings."
    }
    facts_publication = {
      name        = "facts-publication"
      path        = local.facts_publication_path
      description = "Production registry credentials used only by reviewed-facts publication CI."
    }
  }

  secret_shape = {
    (local.application_registry_path) = {
      APPLICATION_REGISTRY_MANAGEMENT_ACCESS_EMAIL = {
        value       = local.placeholder_value
        description = "Single owner email allowed through Cloudflare Access to the personal management UI."
      }
    }

    (local.analytics_path) = {
      CLOUDFLARE_ANALYTICS_API_TOKEN = {
        value       = local.placeholder_value
        description = "Cloudflare token used by the registry API for GraphQL analytics and CV cache purges. Requires Account Analytics Read, Zone Analytics Read, and Cache Purge for the CV zone."
      }
      CLOUDFLARE_GRAPHQL_ENDPOINT = {
        value       = "https://api.cloudflare.com/client/v4/graphql"
        description = "Cloudflare GraphQL endpoint override for the analytics connector."
      }
    }

    (local.deploy_path) = {
      CLOUDFLARE_ACCOUNT_ID = {
        value       = local.placeholder_value
        description = "Cloudflare account ID that owns the retained Access applications."
      }
      CLOUDFLARE_API_TOKEN = {
        value       = local.placeholder_value
        description = "Cloudflare Terraform token with Access and Zone Cache Rules write permissions."
      }
      CLOUDFLARE_ZONE_ID = {
        value       = local.placeholder_value
        description = "Cloudflare zone ID that owns the CV public and analytics hostnames."
      }
      CV_WEB_HOST = {
        value       = local.placeholder_value
        description = "Public CV hostname, for example cv.example.com."
      }
      DOMAIN_NAME = {
        value       = local.placeholder_value
        description = "Cloudflare zone name, for example example.com."
      }
    }
  }

  secrets = merge([
    for path, secrets in local.secret_shape : {
      for name, secret in secrets :
      "${path}:${name}" => merge(secret, {
        name        = name
        folder_path = path
      })
    }
  ]...)

}
