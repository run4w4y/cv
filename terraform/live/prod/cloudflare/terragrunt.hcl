terraform {
  source = "../../../modules/cloudflare-cv"
}

inputs = {
  cloudflare_account_id = get_env("CLOUDFLARE_ACCOUNT_ID")
  cloudflare_api_token  = get_env("CLOUDFLARE_API_TOKEN")
  cloudflare_zone_id    = get_env("CLOUDFLARE_ZONE_ID")
  zone_name             = get_env("DOMAIN_NAME")
  cv_web_host           = get_env("CV_WEB_HOST")

  pages_project_name      = get_env("CLOUDFLARE_PAGES_PROJECT", "cv")
  pages_production_branch = get_env("CLOUDFLARE_PAGES_PRODUCTION_BRANCH", "main")

  worker_custom_domain_hostname = get_env("CV_ANALYTICS_CONNECTOR_HOSTNAME", "")
  worker_route_pattern          = get_env("CV_ANALYTICS_CONNECTOR_ROUTE_PATTERN", "")

  infisical_sync_enabled          = get_env("INFISICAL_PROJECT_ID", "") != ""
  infisical_host                  = get_env("INFISICAL_HOST", "https://app.infisical.com")
  infisical_project_id            = get_env("INFISICAL_PROJECT_ID", "")
  infisical_env_slug              = get_env("INFISICAL_ENV", "prod")
  infisical_analytics_folder_path = "/cv/analytics"
}

generate "backend" {
  path      = "backend.tf"
  if_exists = "overwrite"

  contents = <<EOF
terraform {
  cloud {
    organization = "${get_env("TF_CLOUD_ORGANIZATION")}"

    workspaces {
      project = "${get_env("TF_CLOUD_PROJECT")}"
      name    = "cv-cloudflare"
    }
  }
}
EOF
}
