locals {
  root_path      = "/${var.root_folder_name}"
  analytics_path = "${local.root_path}/analytics"
  content_path   = "${local.root_path}/content"
  deploy_path    = "${local.root_path}/deploy"
  grafana_path   = "${local.root_path}/grafana"

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
    content = {
      name        = "content"
      path        = local.content_path
      description = "Private CV content encryption and build secrets."
    }
    deploy = {
      name        = "deploy"
      path        = local.deploy_path
      description = "Cloudflare account, zone, and project deployment settings."
    }
    grafana = {
      name        = "grafana"
      path        = local.grafana_path
      description = "Grafana API and connector data source provisioning settings."
    }
  }

  secret_shape = {
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
      CONTENT_REPO_TOKEN = {
        value       = local.placeholder_value
        description = "GitHub token or GitHub App installation token used by CI to read the private run4w4y/cv-content repository."
      }
    }

    (local.deploy_path) = {
      CLOUDFLARE_ACCOUNT_ID = {
        value       = local.placeholder_value
        description = "Cloudflare account ID that owns the CV Worker."
      }
      CLOUDFLARE_API_TOKEN = {
        value       = local.placeholder_value
        description = "Cloudflare Terraform token with Workers, Pages, DNS, and Worker Custom Domain permissions."
      }
      CLOUDFLARE_ZONE_ID = {
        value       = local.placeholder_value
        description = "Cloudflare zone ID that owns the CV public and analytics hostnames."
      }
      CV_ANALYTICS_CONNECTOR_HOSTNAME = {
        value       = local.placeholder_value
        description = "Hostname for the analytics connector Worker custom domain, for example analytics.example.com. Use a first-level subdomain on Cloudflare Free."
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

  private_content_root_key = "base64url:${random_id.private_content_root_key.b64_url}"
}
