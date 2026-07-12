resource "grafana_folder" "cv_analytics" {
  title = var.folder_title
  uid   = var.folder_uid
}

resource "grafana_data_source" "infinity" {
  type        = "yesoreyeram-infinity-datasource"
  name        = var.datasource_name
  uid         = var.datasource_uid
  url         = var.connector_base_url
  access_mode = "proxy"

  json_data_encoded = jsonencode({
    auth_method  = "bearerToken"
    allowedHosts = [var.connector_base_url]
  })

  secure_json_data_encoded = jsonencode({
    bearerToken = var.grafana_connector_token
  })
}

resource "grafana_folder" "cv_applications" {
  title = var.applications_folder_title
  uid   = var.applications_folder_uid
}

resource "grafana_data_source" "application_registry" {
  type        = "yesoreyeram-infinity-datasource"
  name        = var.application_registry_datasource_name
  uid         = var.application_registry_datasource_uid
  url         = trimsuffix(var.registry_api_url, "/")
  access_mode = "proxy"

  json_data_encoded = jsonencode({
    auth_method               = "bearerToken"
    allowedHosts              = [trimsuffix(var.registry_api_url, "/")]
    allowDangerousHTTPMethods = false
  })

  secure_json_data_encoded = jsonencode({
    bearerToken = var.registry_api_token
  })
}

resource "grafana_dashboard" "cv_analytics" {
  folder    = grafana_folder.cv_analytics.uid
  overwrite = true

  config_json = templatefile(var.dashboard_template_path, {
    connector_base_url = trimsuffix(var.connector_base_url, "/")
    datasource_uid     = grafana_data_source.infinity.uid
  })
}

resource "grafana_dashboard" "cv_applications" {
  folder    = grafana_folder.cv_applications.uid
  overwrite = true

  config_json = templatefile(var.applications_dashboard_template_path, {
    application_registry_datasource_uid = grafana_data_source.application_registry.uid
    registry_api_url                    = trimsuffix(var.registry_api_url, "/")
  })
}
