variable "job_name" {
  description = "Nomad job and Consul service identity"
  type        = string
  default     = "cv-cache-invalidator"
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
  description = "Immutable cache invalidator image reference, including sha256 digest"
  type        = string
}

variable "resources" {
  description = "Cache invalidator resources"
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

variable "sidecar_resources" {
  description = "Envoy resources for the NATS upstream"
  type = object({
    cpu        = number
    memory     = number
    memory_max = number
  })
  default = {
    cpu        = 25
    memory     = 32
    memory_max = 64
  }
}
