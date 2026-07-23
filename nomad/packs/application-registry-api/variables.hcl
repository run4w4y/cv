variable "job_name" {
  description = "Nomad job and Consul service identity"
  type        = string
  default     = "cv-registry"
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

variable "bff_enabled" {
  description = "Inject browser API credentials; enable only behind Cloudflare Access"
  type        = bool
  default     = false
}

variable "docker_image" {
  description = "Immutable API image reference, including sha256 digest"
  type        = string
}

variable "postgres_max_connections" {
  description = "Maximum PostgreSQL connections held by the API allocation"
  type        = number
  default     = 6
}

variable "resources" {
  description = "API task resources"
  type = object({
    cpu        = number
    memory     = number
    memory_max = number
  })
  default = {
    cpu        = 200
    memory     = 320
    memory_max = 512
  }
}

variable "sidecar_resources" {
  description = "Envoy resources for PostgreSQL and MinIO upstreams"
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
