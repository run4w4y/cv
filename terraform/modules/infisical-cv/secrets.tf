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
    ignore_changes = [
      value_wo,
      value_wo_version,
    ]
  }
}

resource "random_password" "registry_api_token" {
  length  = 48
  special = false
}

resource "random_password" "facts_publish_token" {
  length  = 48
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

resource "infisical_secret" "facts_publish_token" {
  name             = "FACTS_PUBLISH_TOKEN"
  value_wo         = random_password.facts_publish_token.result
  value_wo_version = 1
  env_slug         = var.environment_slug
  workspace_id     = var.infisical_project_id
  folder_path      = local.facts_publication_path

  metadata = merge(local.common_metadata, {
    description = "Terraform-generated bearer token accepted only by the production facts publication API."
    kind        = "generated-secret"
  })

  depends_on = [infisical_secret_folder.child]

  lifecycle {
    prevent_destroy = true
  }
}

moved {
  from = infisical_secret.this["/cv/deploy:CV_ANALYTICS_CONNECTOR_HOSTNAME"]
  to   = infisical_secret.this["/cv/deploy:CLOUDFLARE_WORKERS_DEV_ACCOUNT_SUBDOMAIN"]
}
