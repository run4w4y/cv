terraform {
  source = "../../../modules/cloudflare-cv"
}

inputs = {
  cloudflare_account_id = get_env("CLOUDFLARE_ACCOUNT_ID")
  cloudflare_api_token  = get_env("CLOUDFLARE_API_TOKEN")
  cloudflare_zone_id    = get_env("CLOUDFLARE_ZONE_ID")
  zone_name             = get_env("DOMAIN_NAME")
  cv_web_host           = get_env("CV_WEB_HOST")

  cv_objects_bucket_name           = get_env("CV_OBJECTS_BUCKET_NAME", "cv-objects")
  cv_objects_bucket_location       = get_env("CV_OBJECTS_BUCKET_LOCATION", "weur")
  facts_r2_bucket_name             = get_env("FACTS_R2_BUCKET", "cv-facts")
  facts_r2_bucket_location         = get_env("FACTS_R2_BUCKET_LOCATION", "weur")
  chatgpt_sessions_namespace_title = get_env("CHATGPT_SESSIONS_NAMESPACE_TITLE", "cv-chatgpt-sessions")

  workers_dev_account_subdomain = get_env("CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN")
  worker_name                   = get_env("ANALYTICS_CONNECTOR_WORKER_NAME", "cv-analytics-connector")
  enable_worker_dev_subdomain   = true

  cv_public_worker_name                 = get_env("CV_PUBLIC_WORKER_NAME", "cv-public")
  cv_public_resolver_entrypoint         = get_env("CV_PUBLIC_RESOLVER_ENTRYPOINT", "CvPublicResolver")
  enable_cv_public_route_overlay        = get_env("CV_PUBLIC_ROUTE_OVERLAY_ENABLED", "true") == "true"
  enable_cv_public_worker_dev_subdomain = get_env("CV_PUBLIC_WORKER_DEV_SUBDOMAIN_ENABLED", "true") == "true"

  application_registry_worker_name                    = get_env("APPLICATION_REGISTRY_WORKER_NAME", "cv-application-registry")
  application_registry_management_access_email        = get_env("APPLICATION_REGISTRY_MANAGEMENT_ACCESS_EMAIL")
  application_registry_database_name                  = get_env("APPLICATION_REGISTRY_DB_NAME", "cv-application-registry")
  application_registry_database_primary_location_hint = get_env("APPLICATION_REGISTRY_DB_PRIMARY_LOCATION_HINT", "weur")
  enable_application_registry_worker_dev_subdomain    = get_env("APPLICATION_REGISTRY_WORKERS_DEV_ENABLED", "true") == "true"

  infisical_sync_enabled                     = get_env("INFISICAL_PROJECT_ID", "") != ""
  infisical_host                             = get_env("INFISICAL_HOST", "https://app.infisical.com")
  infisical_project_id                       = get_env("INFISICAL_PROJECT_ID", "")
  infisical_env_slug                         = get_env("INFISICAL_ENV", "prod")
  infisical_analytics_folder_path            = "/cv/analytics"
  infisical_application_registry_folder_path = "/cv/application-registry"
  infisical_cv_public_folder_path            = "/cv/deploy"
  infisical_content_folder_path              = "/cv/content"
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
