variable "job_name" {
  description = "Nomad job and Consul service identity"
  type        = string
  default     = "cv-pdf"
}

variable "datacenters" {
  description = "Eligible Nomad datacenters"
  type        = list(string)
  default     = ["dc1"]
}

variable "enabled" {
  description = "Whether the service group has one running allocation"
  type        = bool
  default     = false
}

variable "docker_image" {
  description = "Immutable PDF runner image reference, including sha256 digest"
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

variable "resources" {
  description = "Playwright runner resources"
  type = object({
    cpu        = number
    memory     = number
    memory_max = number
  })
  default = {
    cpu        = 200
    memory     = 512
    memory_max = 1024
  }
}

variable "sidecar_resources" {
  description = "Shared Envoy resources for PostgreSQL, MinIO, and NATS"
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
