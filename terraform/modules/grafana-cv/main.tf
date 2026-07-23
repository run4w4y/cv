resource "grafana_folder" "cv_analytics" {
  title = var.analytics_folder_title
  uid   = var.analytics_folder_uid
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
    allowedHosts              = [trimsuffix(var.registry_api_url, "/")]
    allowDangerousHTTPMethods = true
  })

  http_headers = {
    Authorization = "Bearer ${var.registry_api_token}"
  }
}

resource "grafana_dashboard" "cv_analytics" {
  folder    = grafana_folder.cv_analytics.uid
  overwrite = true

  config_json = templatefile(var.dashboard_template_path, {
    datasource_uid   = grafana_data_source.application_registry.uid
    registry_api_url = trimsuffix(var.registry_api_url, "/")
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
