variable "job_name" {
  description = "Nomad job and Consul service identity"
  type        = string
  default     = "cv-web"
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
  description = "Immutable CV web image reference, including sha256 digest"
  type        = string
}

variable "deployment_id" {
  description = "Source revision included in the CV render contract version"
  type        = string
}

variable "traefik_subdomain" {
  description = "Cloudflare Tunnel/Traefik hostname label"
  type        = string
  default     = "cv"
}

variable "resources" {
  description = "Next.js task resources"
  type = object({
    cpu        = number
    memory     = number
    memory_max = number
  })
  default = {
    cpu        = 200
    memory     = 256
    memory_max = 512
  }
}

variable "sidecar_resources" {
  description = "Envoy resources for the registry resolver upstream"
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
