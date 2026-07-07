terraform {
  required_version = ">= 1.11.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.4"
    }
    infisical = {
      source  = "Infisical/infisical"
      version = "~> 0.16"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "infisical" {
  host = var.infisical_host
}
