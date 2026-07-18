resource "infisical_secret" "this" {
  for_each = local.secrets

  name             = each.value.name
  value_wo         = each.value.value
  value_wo_version = 1
  env_slug         = var.environment_slug
  workspace_id     = var.infisical_project_id
  folder_path      = each.value.folder_path

  metadata = merge(local.common_metadata, {
    description = each.value.description
    kind        = each.value.value == local.placeholder_value ? "user-placeholder" : "default-value"
  })

  depends_on = [infisical_secret_folder.child]

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      value_wo,
      value_wo_version,
    ]
  }
}

resource "random_password" "grafana_connector_token" {
  length  = 48
  special = false
}

resource "random_password" "registry_api_token" {
  length  = 48
  special = false
}

resource "random_password" "chatgpt_session_secret" {
  length  = 64
  special = false
}

resource "random_password" "private_audience_key" {
  length  = 48
  special = false
}

resource "infisical_secret" "private_audience_key" {
  name             = "PRIVATE_CONTENT_AUDIENCE_KEY"
  value_wo         = random_password.private_audience_key.result
  value_wo_version = 1
  env_slug         = var.environment_slug
  workspace_id     = var.infisical_project_id
  folder_path      = local.content_path

  metadata = merge(local.common_metadata, {
    description = "Terraform-generated key used to derive reversible encrypted private audience URL ids."
    kind        = "generated-secret"
  })

  depends_on = [infisical_secret_folder.child]

  lifecycle {
    prevent_destroy = true
  }
}

resource "infisical_secret" "grafana_connector_token" {
  name             = "GRAFANA_CONNECTOR_TOKEN"
  value_wo         = random_password.grafana_connector_token.result
  value_wo_version = 2
  env_slug         = var.environment_slug
  workspace_id     = var.infisical_project_id
  folder_path      = local.analytics_path

  metadata = merge(local.common_metadata, {
    description = "Terraform-generated bearer token Grafana sends to the analytics connector."
    kind        = "generated-secret"
  })

  depends_on = [infisical_secret_folder.child]

  lifecycle {
    prevent_destroy = true
  }
}

resource "infisical_secret" "registry_api_token" {
  name             = "REGISTRY_API_TOKEN"
  value_wo         = random_password.registry_api_token.result
  value_wo_version = 1
  env_slug         = var.environment_slug
  workspace_id     = var.infisical_project_id
  folder_path      = local.application_registry_path

  metadata = merge(local.common_metadata, {
    description = "Terraform-generated bearer token required by the application registry API."
    kind        = "generated-secret"
  })

  depends_on = [infisical_secret_folder.child]

  lifecycle {
    prevent_destroy = true
  }
}

resource "infisical_secret" "chatgpt_session_secret" {
  name             = "CHATGPT_SESSION_SECRET"
  value_wo         = random_password.chatgpt_session_secret.result
  value_wo_version = 1
  env_slug         = var.environment_slug
  workspace_id     = var.infisical_project_id
  folder_path      = local.application_registry_path

  metadata = merge(local.common_metadata, {
    description = "Terraform-generated key used to encrypt Login with ChatGPT sessions stored in Workers KV."
    kind        = "generated-secret"
  })

  depends_on = [infisical_secret_folder.child]

  lifecycle {
    prevent_destroy = true
  }
}

moved {
  from = infisical_secret.this["/cv/analytics:GRAFANA_CONNECTOR_TOKEN"]
  to   = infisical_secret.grafana_connector_token
}

moved {
  from = infisical_secret.this["/cv/deploy:CV_ANALYTICS_CONNECTOR_HOSTNAME"]
  to   = infisical_secret.this["/cv/deploy:CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN"]
}
