variable "nats_servers" {
  type        = string
  description = "Comma-separated NATS server URLs reachable by the local Terraform execution environment."

  validation {
    condition     = length(trimspace(var.nats_servers)) > 0
    error_message = "nats_servers must be set."
  }
}

variable "nats_username" {
  type        = string
  description = "NATS administration username used only while applying this topology."
  sensitive   = true
  ephemeral   = true

  validation {
    condition     = length(trimspace(var.nats_username)) > 0
    error_message = "nats_username must be set."
  }
}

variable "nats_password" {
  type        = string
  description = "NATS administration password used only while applying this topology."
  sensitive   = true
  ephemeral   = true

  validation {
    condition     = length(var.nats_password) > 0
    error_message = "nats_password must be set."
  }
}
