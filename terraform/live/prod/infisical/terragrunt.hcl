terraform {
  source = "../../../modules/infisical-cv"
}

inputs = {
  infisical_host       = get_env("INFISICAL_HOST", "https://app.infisical.com")
  infisical_project_id = get_env("INFISICAL_PROJECT_ID", "")
  environment_slug     = get_env("INFISICAL_ENV", "prod")
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
      name    = "cv-infisical"
    }
  }
}
EOF
}
