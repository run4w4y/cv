resource "infisical_secret_folder" "root" {
  project_id       = var.infisical_project_id
  environment_slug = var.environment_slug
  folder_path      = "/"
  name             = var.root_folder_name
  description      = "CV project secrets."
  force_delete     = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "infisical_secret_folder" "managed_child" {
  for_each = local.child_folders

  project_id       = var.infisical_project_id
  environment_slug = var.environment_slug
  folder_path      = local.root_path
  name             = each.value.name
  description      = each.value.description
  force_delete     = false

  depends_on = [infisical_secret_folder.root]

  lifecycle {
    prevent_destroy = true
  }
}
