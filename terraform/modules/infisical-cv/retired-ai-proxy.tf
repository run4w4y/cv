# Delete the former Cloudflare proxy credentials during the state transition.
# The local Codex app-server owns authentication now.
removed {
  from = random_password.chatgpt_session_secret

  lifecycle {
    destroy = true
  }
}

removed {
  from = infisical_secret.chatgpt_session_secret

  lifecycle {
    destroy = true
  }
}
