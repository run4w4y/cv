output "registry_event_stream_name" {
  value       = jetstream_stream.registry_events.name
  description = "Application-registry event stream name."
}

output "registry_pdf_worker_consumer_name" {
  value       = jetstream_consumer.registry_pdf_worker.durable_name
  description = "Durable PDF worker consumer name."
}
