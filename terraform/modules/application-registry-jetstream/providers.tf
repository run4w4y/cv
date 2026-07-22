terraform {
  required_version = ">= 1.11.0"

  required_providers {
    jetstream = {
      source  = "nats-io/jetstream"
      version = "0.4.0"
    }
  }
}

provider "jetstream" {
  servers  = var.nats_servers
  user     = var.nats_username
  password = var.nats_password
}
