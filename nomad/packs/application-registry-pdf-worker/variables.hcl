variable "job_name" {
  description = "Nomad job and Consul service identity"
  type        = string
  default     = "cv-pdf-worker"
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
  description = "Immutable PDF worker image reference, including sha256 digest"
  type        = string
}

variable "resources" {
  description = "PDF event worker resources; Chromium runs in its own allocation"
  type = object({
    cpu        = number
    memory     = number
    memory_max = number
  })
  default = {
    cpu        = 100
    memory     = 256
    memory_max = 512
  }
}

variable "sidecar_resources" {
  description = "Shared Envoy resources for PostgreSQL, MinIO, NATS, and Chromium"
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
