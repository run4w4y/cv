variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID that owns the retained Workers and Access applications."

  validation {
    condition     = length(trimspace(var.cloudflare_account_id)) > 0
    error_message = "cloudflare_account_id must be set."
  }
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare token with Workers Routes, Access, and Zone write permissions."
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

variable "worker_name" {
  type        = string
  description = "Analytics connector Worker script name."
  default     = "cv-analytics-connector"
}

variable "workers_dev_account_subdomain" {
  type        = string
  description = "Account-level workers.dev label used for retained Worker URLs."
  default     = ""

  validation {
    condition = (
      (!var.enable_worker_dev_subdomain && !var.enable_cv_public_worker_dev_subdomain) ||
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
  description = "Public CV hostname backed by frozen Pages except for the /c/* Worker overlay."

  validation {
    condition     = length(trimspace(var.cv_web_host)) > 0
    error_message = "cv_web_host must be set."
  }
}

variable "cv_public_worker_name" {
  type        = string
  description = "Public SSR CV Worker script name."
  default     = "cv-public"

  validation {
    condition     = length(trimspace(var.cv_public_worker_name)) > 0
    error_message = "cv_public_worker_name must be set."
  }
}

variable "cv_public_resolver_url" {
  type        = string
  description = "Cloudflare Tunnel origin used by the public CV Worker to resolve publication capabilities."

  validation {
    condition     = can(regex("^https://[^/]+/?$", trimspace(var.cv_public_resolver_url)))
    error_message = "cv_public_resolver_url must be an HTTPS origin URL without a path."
  }
}

variable "enable_cv_public_route_overlay" {
  type        = bool
  description = "Attach the /c/* Worker route overlay after the public SSR Worker is deployed."
  default     = true
}

variable "enable_cv_public_worker_dev_subdomain" {
  type        = bool
  description = "Expose the public SSR CV Worker on workers.dev."
  default     = false
}

variable "worker_custom_domain_hostname" {
  type        = string
  description = "Optional analytics Worker Custom Domain hostname."
  default     = ""
}

variable "worker_route_pattern" {
  type        = string
  description = "Optional analytics Worker route pattern."
  default     = ""
}

variable "enable_worker_dev_subdomain" {
  type        = bool
  description = "Expose the analytics connector Worker on workers.dev."
  default     = false
}

variable "application_registry_api_url" {
  type        = string
  description = "Cloudflare Tunnel URL for the self-hosted registry API and management UI."

  validation {
    condition     = can(regex("^https://[^/]+/?$", trimspace(var.application_registry_api_url)))
    error_message = "application_registry_api_url must be an HTTPS origin URL without a path."
  }
}

variable "application_registry_management_access_email" {
  type        = string
  description = "Email allowed through Cloudflare Access to the registry management UI. Empty disables Access."
  default     = ""

  validation {
    condition = (
      trimspace(var.application_registry_management_access_email) == "" ||
      can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", trimspace(var.application_registry_management_access_email)))
    )
    error_message = "application_registry_management_access_email must be empty or a valid email address."
  }
}

variable "infisical_sync_enabled" {
  type        = bool
  description = "Whether to write derived Cloudflare and tunnel deployment values to Infisical."
  default     = false
}

variable "infisical_host" {
  type        = string
  description = "Infisical API host."
  default     = "https://app.infisical.com"
}

variable "infisical_project_id" {
  type        = string
  description = "Infisical project ID that receives deployment values."
  default     = ""

  validation {
    condition     = !var.infisical_sync_enabled || length(trimspace(var.infisical_project_id)) > 0
    error_message = "infisical_project_id must be set when infisical_sync_enabled is true."
  }
}

variable "infisical_env_slug" {
  type        = string
  description = "Infisical environment slug."
  default     = "prod"
}

variable "infisical_analytics_folder_path" {
  type        = string
  description = "Infisical folder receiving analytics values."
  default     = "/cv/analytics"

  validation {
    condition     = startswith(var.infisical_analytics_folder_path, "/")
    error_message = "infisical_analytics_folder_path must start with '/'."
  }
}

variable "infisical_application_registry_folder_path" {
  type        = string
  description = "Infisical folder receiving registry deployment values."
  default     = "/cv/application-registry"

  validation {
    condition     = startswith(var.infisical_application_registry_folder_path, "/")
    error_message = "infisical_application_registry_folder_path must start with '/'."
  }
}

variable "infisical_cv_public_folder_path" {
  type        = string
  description = "Infisical folder receiving public CV Worker deployment values."
  default     = "/cv/deploy"

  validation {
    condition     = startswith(var.infisical_cv_public_folder_path, "/")
    error_message = "infisical_cv_public_folder_path must start with '/'."
  }
}

variable "infisical_facts_publication_folder_path" {
  type        = string
  description = "Infisical folder receiving the facts-publication registry endpoint."
  default     = "/cv/facts-publication"

  validation {
    condition     = startswith(var.infisical_facts_publication_folder_path, "/")
    error_message = "infisical_facts_publication_folder_path must start with '/'."
  }
}
