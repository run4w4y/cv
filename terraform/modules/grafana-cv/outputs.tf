output "analytics_dashboard_url" {
  description = "Provisioned CV analytics dashboard URL."
  value       = grafana_dashboard.cv_analytics.url
}

output "applications_dashboard_url" {
  description = "Provisioned CV applications dashboard URL."
  value       = grafana_dashboard.cv_applications.url
}

output "application_registry_datasource_uid" {
  description = "Grafana Infinity data source UID for the registry and analytics APIs."
  value       = grafana_data_source.application_registry.uid
}
