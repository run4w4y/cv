terraform {
  required_version = ">= 1.11.0"

  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 3.25, < 5.0"
    }
  }
}

provider "grafana" {
  url  = var.grafana_url
  auth = var.grafana_auth
}
