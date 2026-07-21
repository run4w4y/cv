# The Electron pivot no longer uses a Cloudflare-hosted ChatGPT session. Delete
# the obsolete KV namespace and its synced Infisical identifier during the
# state transition.
removed {
  from = cloudflare_workers_kv_namespace.chatgpt_sessions

  lifecycle {
    destroy = true
  }
}

removed {
  from = infisical_secret.chatgpt_sessions_namespace_id

  lifecycle {
    destroy = true
  }
}
