terraform {
  source = "../../../modules/grafana-cv"
}

inputs = {
  grafana_url             = get_env("GRAFANA_URL")
  grafana_auth            = get_env("GRAFANA_AUTH")
  connector_base_url      = get_env("ANALYTICS_CONNECTOR_URL")
  grafana_connector_token = get_env("GRAFANA_CONNECTOR_TOKEN")
  dashboard_template_path = "${get_repo_root()}/terraform/grafana/dashboards/cv-analytics.json.tftpl"
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
      name    = "cv-grafana"
    }
  }
}
EOF
}
