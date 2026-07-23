terraform {
  required_version = ">= 1.11.0"

  required_providers {
    infisical = {
      source  = "Infisical/infisical"
      version = "~> 0.16.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "infisical" {
  host = var.infisical_host
}
