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

resource "random_password" "content_id_salt" {
  length  = 48
  special = false
}

resource "random_password" "private_audience_key" {
  length  = 48
  special = false
}

resource "random_id" "private_content_root_key" {
  byte_length = 32
}

resource "infisical_secret" "content_id_salt" {
  name             = "CONTENT_ID_SALT"
  value_wo         = random_password.content_id_salt.result
  value_wo_version = 1
  env_slug         = var.environment_slug
  workspace_id     = var.infisical_project_id
  folder_path      = local.content_path

  metadata = merge(local.common_metadata, {
    description = "Terraform-generated salt used to derive opaque public CV content ids from source ids."
    kind        = "generated-secret"
  })

  depends_on = [infisical_secret_folder.child]

  lifecycle {
    prevent_destroy = true
  }
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

resource "infisical_secret" "private_content_root_key" {
  name             = "PRIVATE_CONTENT_ROOT_KEY"
  value_wo         = local.private_content_root_key
  value_wo_version = 1
  env_slug         = var.environment_slug
  workspace_id     = var.infisical_project_id
  folder_path      = local.content_path

  metadata = merge(local.common_metadata, {
    description = "Terraform-generated 32-byte root key used by TypeScript build tooling to derive private profile content keys."
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

moved {
  from = infisical_secret.this["/cv/analytics:GRAFANA_CONNECTOR_TOKEN"]
  to   = infisical_secret.grafana_connector_token
}

moved {
  from = infisical_secret.this["/cv/deploy:CV_ANALYTICS_CONNECTOR_HOSTNAME"]
  to   = infisical_secret.this["/cv/deploy:CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN"]
}
