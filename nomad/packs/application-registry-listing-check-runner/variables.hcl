variable "job_name" {
  description = "Nomad job and Consul service identity"
  type        = string
  default     = "cv-listing-checker"
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
  description = "UTC cron for the periodic one-shot run"
  type        = string
  default     = "17 * * * *"
}

variable "docker_image" {
  description = "Immutable runner image reference, including sha256 digest"
  type        = string
}

variable "listing_check_batch_size" {
  description = "Maximum listings checked by one periodic child"
  type        = number
  default     = 5
}

variable "listing_check_mode" {
  description = "Listing-check policy mode"
  type        = string
  default     = "archive_eligible"
}

variable "resources" {
  description = "Runner task resources"
  type = object({
    cpu    = number
    memory = number
  })
  default = {
    cpu    = 100
    memory = 192
  }
}

variable "sidecar_resources" {
  description = "Short-lived PostgreSQL Envoy resources"
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
