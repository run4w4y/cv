variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account that owns the retained Access applications."

  validation {
    condition     = length(trimspace(var.cloudflare_account_id)) > 0
    error_message = "cloudflare_account_id must be set."
  }
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare token with Access and Zone Cache Rules write permissions."
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

variable "cv_web_host" {
  type        = string
  description = "Public CV hostname served through Cloudflare Tunnel and Traefik."

  validation {
    condition     = length(trimspace(var.cv_web_host)) > 0
    error_message = "cv_web_host must be set."
  }
}

variable "application_registry_api_url" {
  type        = string
  description = "Public Cloudflare Tunnel URL for the self-hosted registry API."

  validation {
    condition     = can(regex("^https://[^/]+/?$", trimspace(var.application_registry_api_url)))
    error_message = "application_registry_api_url must be an HTTPS origin URL without a path."
  }
}

variable "application_registry_web_url" {
  type        = string
  description = "Cloudflare Access-protected URL for the self-hosted registry web allocation."

  validation {
    condition     = can(regex("^https://[^/]+/?$", trimspace(var.application_registry_web_url)))
    error_message = "application_registry_web_url must be an HTTPS origin URL without a path."
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
  description = "Whether to write the registry Tunnel URL to Infisical."
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

variable "infisical_application_registry_folder_path" {
  type        = string
  description = "Infisical folder receiving the registry deployment URL."
  default     = "/cv/application-registry"

  validation {
    condition     = startswith(var.infisical_application_registry_folder_path, "/")
    error_message = "infisical_application_registry_folder_path must start with '/'."
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
