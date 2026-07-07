resource "cloudflare_pages_project" "cv" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = var.pages_production_branch
}

resource "cloudflare_pages_domain" "cv" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.cv.name
  name         = var.cv_web_host
}

resource "cloudflare_dns_record" "cv_pages_domain" {
  zone_id = var.cloudflare_zone_id
  name    = var.cv_web_host
  type    = "CNAME"
  ttl     = 1
  content = cloudflare_pages_project.cv.subdomain
  proxied = true
}
