output "dashboard_url" {
  description = "Provisioned CV analytics dashboard URL."
  value       = grafana_dashboard.cv_analytics.url
}

output "datasource_uid" {
  description = "Grafana Infinity data source UID."
  value       = grafana_data_source.infinity.uid
}

output "folder_uid" {
  description = "Grafana folder UID."
  value       = grafana_folder.cv_analytics.uid
}
