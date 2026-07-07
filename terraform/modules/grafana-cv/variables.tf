variable "grafana_url" {
  type        = string
  description = "Grafana base URL."

  validation {
    condition     = length(trimspace(var.grafana_url)) > 0
    error_message = "grafana_url must be set."
  }
}

variable "grafana_auth" {
  type        = string
  description = "Grafana provider auth token, usually a service-account token."
  sensitive   = true

  validation {
    condition     = length(trimspace(var.grafana_auth)) > 0
    error_message = "grafana_auth must be set."
  }
}

variable "connector_base_url" {
  type        = string
  description = "Public base URL for the analytics connector Worker."

  validation {
    condition     = can(regex("^https://", var.connector_base_url))
    error_message = "connector_base_url must be an https URL."
  }
}

variable "grafana_connector_token" {
  type        = string
  description = "Bearer token Grafana sends to the analytics connector."
  sensitive   = true

  validation {
    condition     = length(trimspace(var.grafana_connector_token)) > 0
    error_message = "grafana_connector_token must be set."
  }
}

variable "dashboard_template_path" {
  type        = string
  description = "Path to the Grafana dashboard JSON template."

  validation {
    condition     = length(trimspace(var.dashboard_template_path)) > 0
    error_message = "dashboard_template_path must be set."
  }
}

variable "datasource_name" {
  type        = string
  description = "Grafana data source name."
  default     = "CV Analytics Connector"
}

variable "datasource_uid" {
  type        = string
  description = "Stable Grafana data source UID used by dashboards."
  default     = "cv-analytics-connector"
}

variable "folder_title" {
  type        = string
  description = "Grafana folder title."
  default     = "CV Analytics"
}

variable "folder_uid" {
  type        = string
  description = "Stable Grafana folder UID."
  default     = "cv-analytics"
}
