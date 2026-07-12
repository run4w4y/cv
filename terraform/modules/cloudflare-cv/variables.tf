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
  description = "Cloudflare deploy token with Account Workers Scripts, D1 Write, Pages Write, and Zone DNS Write permissions."
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

variable "workers_dev_account_subdomain" {
  type        = string
  description = "Cloudflare account-level workers.dev subdomain label used to construct Worker URLs."
  default     = ""

  validation {
    condition = (
      (!var.enable_worker_dev_subdomain && !var.enable_application_registry_worker_dev_subdomain) ||
      length(trimspace(var.workers_dev_account_subdomain)) > 0
    )
    error_message = "workers_dev_account_subdomain must be set when a Worker is exposed on workers.dev."
  }

  validation {
    condition = (
      trimspace(var.workers_dev_account_subdomain) == "" ||
      !strcontains(trimspace(var.workers_dev_account_subdomain), ".")
    )
    error_message = "workers_dev_account_subdomain must be the account label only, without .workers.dev."
  }
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
  description = "Expose the analytics connector Worker on workers.dev."
  default     = false
}

variable "application_registry_worker_name" {
  type        = string
  description = "Application registry Worker script name."
  default     = "cv-application-registry"

  validation {
    condition     = length(trimspace(var.application_registry_worker_name)) > 0
    error_message = "application_registry_worker_name must be set."
  }
}

variable "application_registry_database_name" {
  type        = string
  description = "D1 database name used by the application registry Worker."
  default     = "cv-application-registry"

  validation {
    condition     = length(trimspace(var.application_registry_database_name)) > 0
    error_message = "application_registry_database_name must be set."
  }
}

variable "application_registry_database_primary_location_hint" {
  type        = string
  description = "Cloudflare D1 primary location hint. Leave empty to let Cloudflare choose."
  default     = "weur"

  validation {
    condition = contains(
      ["", "wnam", "enam", "weur", "eeur", "apac", "oc"],
      trimspace(var.application_registry_database_primary_location_hint)
    )
    error_message = "application_registry_database_primary_location_hint must be empty or one of wnam, enam, weur, eeur, apac, or oc."
  }
}

variable "application_registry_worker_custom_domain_hostname" {
  type        = string
  description = "Optional application registry Worker Custom Domain hostname, for example applications.example.com."
  default     = ""
}

variable "application_registry_worker_route_pattern" {
  type        = string
  description = "Optional application registry Worker route pattern, for example applications.example.com/*. Prefer a custom domain."
  default     = ""
}

variable "enable_application_registry_worker_dev_subdomain" {
  type        = bool
  description = "Expose the application registry Worker on workers.dev."
  default     = false
}

variable "infisical_sync_enabled" {
  type        = bool
  description = "Whether to write Cloudflare-derived analytics and application registry values back into Infisical."
  default     = false
}

variable "infisical_host" {
  type        = string
  description = "Infisical API host. Defaults to Infisical Cloud."
  default     = "https://app.infisical.com"
}

variable "infisical_project_id" {
  type        = string
  description = "Infisical project ID that receives Cloudflare-derived deployment values."
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

variable "infisical_application_registry_folder_path" {
  type        = string
  description = "Infisical folder path that receives Cloudflare-derived application registry deployment values."
  default     = "/cv/application-registry"

  validation {
    condition     = startswith(var.infisical_application_registry_folder_path, "/")
    error_message = "infisical_application_registry_folder_path must start with '/'."
  }
}
