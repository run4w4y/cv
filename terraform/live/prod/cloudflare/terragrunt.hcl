terraform {
  source = "../../../modules/cloudflare-cv"
}

inputs = {
  cloudflare_account_id = get_env("CLOUDFLARE_ACCOUNT_ID")
  cloudflare_api_token  = get_env("CLOUDFLARE_API_TOKEN")
  cloudflare_zone_id    = get_env("CLOUDFLARE_ZONE_ID")
  cv_web_host           = get_env("CV_WEB_HOST")

  application_registry_api_url                 = "https://registry-origin.${get_env("DOMAIN_NAME")}"
  application_registry_management_access_email = get_env("APPLICATION_REGISTRY_MANAGEMENT_ACCESS_EMAIL")

  infisical_sync_enabled                     = get_env("INFISICAL_PROJECT_ID", "") != ""
  infisical_host                             = get_env("INFISICAL_HOST", "https://app.infisical.com")
  infisical_project_id                       = get_env("INFISICAL_PROJECT_ID", "")
  infisical_env_slug                         = get_env("INFISICAL_ENV", "prod")
  infisical_application_registry_folder_path = "/cv/application-registry"
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
