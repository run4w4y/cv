resource "jetstream_stream" "registry_events" {
  name        = "REGISTRY_EVENTS"
  description = "Durable application-registry domain events."
  subjects    = ["registry.events.>"]

  storage          = "file"
  retention        = "limits"
  discard          = "old"
  replicas         = 1
  max_age          = 7 * 24 * 60 * 60
  max_bytes        = 256 * 1024 * 1024
  max_msgs         = 50000
  max_msg_size     = 64 * 1024
  max_consumers    = -1
  duplicate_window = 24 * 60 * 60

  lifecycle {
    prevent_destroy = true
  }
}

resource "jetstream_consumer" "registry_pdf_worker" {
  stream_id    = jetstream_stream.registry_events.id
  durable_name = "registry-pdf-worker"
  description  = "Durable application-registry PDF generation worker."

  ack_policy  = "explicit"
  ack_wait    = 120
  deliver_all = true
  filter_subjects = [
    "registry.events.cv.publication-availability-changed.v1",
    "registry.events.cv.pdf-generation-requested.v1",
  ]
  max_ack_pending = 1
  max_delivery    = 5
  max_waiting     = 4
  max_expires     = 30
  replay_policy   = "instant"
  replicas        = 1

  lifecycle {
    prevent_destroy = true
  }
}

resource "jetstream_consumer" "registry_cache_invalidator" {
  stream_id    = jetstream_stream.registry_events.id
  durable_name = "registry-cache-invalidator"
  description  = "Durable Cloudflare invalidation consumer for public CV publication changes."

  ack_policy      = "explicit"
  ack_wait        = 60
  deliver_all     = true
  filter_subjects = ["registry.events.cv.publication-changed.v1"]
  max_ack_pending = 16
  max_delivery    = 10
  max_waiting     = 4
  max_expires     = 30
  replay_policy   = "instant"
  replicas        = 1

  lifecycle {
    prevent_destroy = true
  }
}
