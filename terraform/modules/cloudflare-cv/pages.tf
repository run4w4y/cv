# The v1 Pages deployment is intentionally frozen in place. These state
# removals must be applied once before this file is deleted. `destroy = false`
# preserves the Pages project, its custom-domain attachment, and the proxied
# CNAME while removing them from Terraform ownership.
removed {
  from = cloudflare_pages_project.cv

  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_pages_domain.cv

  lifecycle {
    destroy = false
  }
}

removed {
  from = cloudflare_dns_record.cv_pages_domain

  lifecycle {
    destroy = false
  }
}
