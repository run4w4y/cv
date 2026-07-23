variable "job_name" {
  description = "Nomad job and Consul service identity"
  type        = string
  default     = "cv-registry-web"
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
  description = "Immutable management SPA image reference, including sha256 digest"
  type        = string
}

variable "traefik_subdomain" {
  description = "Cloudflare Tunnel/Traefik hostname label"
  type        = string
  default     = "registry-origin"
}

variable "resources" {
  description = "Nginx task resources"
  type = object({
    cpu        = number
    memory     = number
    memory_max = number
  })
  default = {
    cpu        = 50
    memory     = 32
    memory_max = 64
  }
}

variable "sidecar_resources" {
  description = "Envoy resources for the registry API upstream"
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
