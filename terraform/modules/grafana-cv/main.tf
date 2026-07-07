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

resource "grafana_dashboard" "cv_analytics" {
  folder    = grafana_folder.cv_analytics.uid
  overwrite = true

  config_json = templatefile(var.dashboard_template_path, {
    connector_base_url = trimsuffix(var.connector_base_url, "/")
    datasource_uid     = grafana_data_source.infinity.uid
  })
}
