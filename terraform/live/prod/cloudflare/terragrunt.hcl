terraform {
  source = "../../../modules/cloudflare-cv"
}

inputs = {
  cloudflare_account_id = get_env("CLOUDFLARE_ACCOUNT_ID")
  cloudflare_api_token  = get_env("CLOUDFLARE_API_TOKEN")
  cloudflare_zone_id    = get_env("CLOUDFLARE_ZONE_ID")
  zone_name             = get_env("DOMAIN_NAME")
  cv_web_host           = get_env("CV_WEB_HOST")

  workers_dev_account_subdomain = get_env("CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN")
  worker_name                   = get_env("ANALYTICS_CONNECTOR_WORKER_NAME", "cv-analytics-connector")
  enable_worker_dev_subdomain   = true

  cv_public_worker_name                 = get_env("CV_PUBLIC_WORKER_NAME", "cv-public")
  cv_public_resolver_url                = get_env("CV_PUBLIC_RESOLVER_URL", "https://registry-origin.${get_env("DOMAIN_NAME")}")
  enable_cv_public_route_overlay        = get_env("CV_PUBLIC_ROUTE_OVERLAY_ENABLED", "true") == "true"
  enable_cv_public_worker_dev_subdomain = get_env("CV_PUBLIC_WORKER_DEV_SUBDOMAIN_ENABLED", "true") == "true"

  application_registry_api_url                 = get_env("REGISTRY_API_URL", "https://registry-origin.${get_env("DOMAIN_NAME")}")
  application_registry_management_access_email = get_env("APPLICATION_REGISTRY_MANAGEMENT_ACCESS_EMAIL")

  infisical_sync_enabled                     = get_env("INFISICAL_PROJECT_ID", "") != ""
  infisical_host                             = get_env("INFISICAL_HOST", "https://app.infisical.com")
  infisical_project_id                       = get_env("INFISICAL_PROJECT_ID", "")
  infisical_env_slug                         = get_env("INFISICAL_ENV", "prod")
  infisical_analytics_folder_path            = "/cv/analytics"
  infisical_application_registry_folder_path = "/cv/application-registry"
  infisical_cv_public_folder_path            = "/cv/deploy"
  infisical_facts_publication_folder_path    = "/cv/facts-publication"
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
