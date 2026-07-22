# Keep the source database available for the one-time PostgreSQL import while
# removing it from this stack. Delete this state-transition block after the
# first successful post-cutover apply.
removed {
  from = cloudflare_d1_database.application_registry

  lifecycle {
    destroy = false
  }
}
