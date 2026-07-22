locals {
  root_path                 = "/${var.root_folder_name}"
  analytics_path            = "${local.root_path}/analytics"
  application_registry_path = "${local.root_path}/application-registry"
  content_path              = "${local.root_path}/content"
  deploy_path               = "${local.root_path}/deploy"
  facts_publication_path    = "${local.root_path}/facts-publication"
  grafana_path              = "${local.root_path}/grafana"

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
      description = "Runtime analytics connector secrets and derived deployment outputs."
    }
    application_registry = {
      name        = "application-registry"
      path        = local.application_registry_path
      description = "Personal application registry authentication and Cloudflare deployment values."
    }
    content = {
      name        = "content"
      path        = local.content_path
      description = "Reviewed facts publication and frozen analytics compatibility secrets."
    }
    deploy = {
      name        = "deploy"
      path        = local.deploy_path
      description = "Cloudflare account, zone, and project deployment settings."
    }
    facts_publication = {
      name        = "facts-publication"
      path        = local.facts_publication_path
      description = "Production registry credentials used only by reviewed-facts publication CI."
    }
    grafana = {
      name        = "grafana"
      path        = local.grafana_path
      description = "Grafana API and connector data source provisioning settings."
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
      CACHE_TTL_SECONDS = {
        value       = "600"
        description = "Analytics connector response cache TTL in seconds."
      }
      CLOUDFLARE_ANALYTICS_API_TOKEN = {
        value       = local.placeholder_value
        description = "Cloudflare token used by the Worker to read GraphQL analytics. Requires Account Analytics Read and Zone Analytics Read for the CV zone."
      }
      CLOUDFLARE_GRAPHQL_ENDPOINT = {
        value       = "https://api.cloudflare.com/client/v4/graphql"
        description = "Cloudflare GraphQL endpoint override for the analytics connector."
      }
    }

    (local.content_path) = {
      PUBLIC_CV_FULL_ACCESS_EMAIL = {
        value       = local.placeholder_value
        description = "Frozen v1 redaction-contact value retained only to preserve existing Infisical state; CV v2 does not consume it."
      }
    }

    (local.deploy_path) = {
      CLOUDFLARE_ACCOUNT_ID = {
        value       = local.placeholder_value
        description = "Cloudflare account ID that owns the CV Worker."
      }
      CLOUDFLARE_API_TOKEN = {
        value       = local.placeholder_value
        description = "Cloudflare Terraform token with Workers, D1, Pages, and DNS permissions."
      }
      CLOUDFLARE_ZONE_ID = {
        value       = local.placeholder_value
        description = "Cloudflare zone ID that owns the CV public and analytics hostnames."
      }
      CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN = {
        value       = local.placeholder_value
        description = "Cloudflare account-level workers.dev subdomain label, without .workers.dev."
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

    (local.grafana_path) = {
      GRAFANA_AUTH = {
        value       = local.placeholder_value
        description = "Grafana provider auth token, usually a service-account token."
      }
      GRAFANA_URL = {
        value       = local.placeholder_value
        description = "Grafana base URL."
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
