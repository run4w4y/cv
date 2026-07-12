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

output "applications_dashboard_url" {
  description = "Provisioned CV applications dashboard URL."
  value       = grafana_dashboard.cv_applications.url
}

output "application_registry_datasource_uid" {
  description = "Grafana Infinity data source UID for the application registry."
  value       = grafana_data_source.application_registry.uid
}

output "applications_folder_uid" {
  description = "Grafana applications folder UID."
  value       = grafana_folder.cv_applications.uid
}
