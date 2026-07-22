terraform {
  source = "../../../modules/application-registry-jetstream"
}

inputs = {
  nats_servers  = get_env("NATS_ADMIN_SERVER")
  nats_username = get_env("NATS_ADMIN_USER")
  nats_password = get_env("NATS_ADMIN_PASSWORD")
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
      name    = "cv-jetstream"
    }
  }
}
EOF
}
