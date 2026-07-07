variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID that owns the Worker."

  validation {
    condition     = length(trimspace(var.cloudflare_account_id)) > 0
    error_message = "cloudflare_account_id must be set."
  }
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare deploy token with Account Workers Scripts, Pages Write, and Zone DNS Write permissions."
  sensitive   = true

  validation {
    condition     = length(trimspace(var.cloudflare_api_token)) > 0
    error_message = "cloudflare_api_token must be set."
  }
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID that owns the CV hostnames."

  validation {
    condition     = length(trimspace(var.cloudflare_zone_id)) > 0
    error_message = "cloudflare_zone_id must be set."
  }
}

variable "zone_name" {
  type        = string
  description = "Cloudflare zone name, for example example.com."

  validation {
    condition     = length(trimspace(var.zone_name)) > 0
    error_message = "zone_name must be set."
  }
}

variable "pages_project_name" {
  type        = string
  description = "Cloudflare Pages project name for the public CV site."
  default     = "cv"

  validation {
    condition     = length(trimspace(var.pages_project_name)) > 0
    error_message = "pages_project_name must be set."
  }
}

variable "pages_production_branch" {
  type        = string
  description = "Production branch for the Cloudflare Pages project."
  default     = "main"

  validation {
    condition     = length(trimspace(var.pages_production_branch)) > 0
    error_message = "pages_production_branch must be set."
  }
}

variable "worker_name" {
  type        = string
  description = "Analytics connector Worker script name."
  default     = "cv-analytics-connector"
}

variable "cv_web_host" {
  type        = string
  description = "Hostname whose Cloudflare analytics should be queried, for example cv.example.com."

  validation {
    condition     = length(trimspace(var.cv_web_host)) > 0
    error_message = "cv_web_host must be set."
  }
}

variable "worker_custom_domain_hostname" {
  type        = string
  description = "Optional Worker Custom Domain hostname, for example analytics.example.com."
  default     = ""
}

variable "worker_route_pattern" {
  type        = string
  description = "Optional Worker route pattern, for example analytics.example.com/*. Prefer custom domains for the connector."
  default     = ""
}

variable "enable_worker_dev_subdomain" {
  type        = bool
  description = "Expose the Worker on workers.dev as well as configured custom domains/routes."
  default     = false
}

variable "infisical_sync_enabled" {
  type        = bool
  description = "Whether to write Cloudflare-derived analytics values back into Infisical."
  default     = false
}

variable "infisical_host" {
  type        = string
  description = "Infisical API host. Defaults to Infisical Cloud."
  default     = "https://app.infisical.com"
}

variable "infisical_project_id" {
  type        = string
  description = "Infisical project ID that receives Cloudflare-derived analytics values."
  default     = ""

  validation {
    condition     = !var.infisical_sync_enabled || length(trimspace(var.infisical_project_id)) > 0
    error_message = "infisical_project_id must be set when infisical_sync_enabled is true."
  }
}

variable "infisical_env_slug" {
  type        = string
  description = "Infisical environment slug that receives Cloudflare-derived analytics values."
  default     = "prod"
}

variable "infisical_analytics_folder_path" {
  type        = string
  description = "Infisical folder path that receives Cloudflare-derived analytics values."
  default     = "/cv/analytics"

  validation {
    condition     = startswith(var.infisical_analytics_folder_path, "/")
    error_message = "infisical_analytics_folder_path must start with '/'."
  }
}
