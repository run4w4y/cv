variable "job_name" {
  description = "Nomad periodic job name"
  type        = string
  default     = "cv-pdf-dispatcher"
}

variable "service_name" {
  description = "Consul service identity used for PostgreSQL and NATS intentions"
  type        = string
  default     = "cv-registry"
}

variable "datacenters" {
  description = "Eligible Nomad datacenters"
  type        = list(string)
  default     = ["dc1"]
}

variable "enabled" {
  description = "Whether Nomad creates new periodic children"
  type        = bool
  default     = false
}

variable "schedule" {
  description = "UTC cron for the outbox dispatch run"
  type        = string
  default     = "* * * * *"
}

variable "docker_image" {
  description = "Immutable dispatcher image reference, including sha256 digest"
  type        = string
}

variable "docker_image_username" {
  description = "Optional registry username"
  type        = string
  default     = null
}

variable "docker_image_password" {
  description = "Optional registry password"
  type        = string
  default     = null
}

variable "batch_size" {
  description = "Maximum pending outbox entries published per run"
  type        = number
  default     = 25
}

variable "resources" {
  description = "Short-lived dispatcher resources"
  type = object({
    cpu        = number
    memory     = number
    memory_max = number
  })
  default = {
    cpu        = 75
    memory     = 128
    memory_max = 192
  }
}

variable "sidecar_resources" {
  description = "Short-lived shared Envoy resources for PostgreSQL and NATS"
  type = object({
    cpu        = number
    memory     = number
    memory_max = number
  })
  default = {
    cpu        = 50
    memory     = 64
    memory_max = 128
  }
}
