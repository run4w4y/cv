resource "cloudflare_ruleset" "cv_public_cache" {
  zone_id     = var.cloudflare_zone_id
  name        = "CV public page caching"
  description = "Make public CV HTML eligible for Cloudflare edge caching while respecting origin TTL and stale directives."
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules = [{
    action      = "set_cache_settings"
    description = "Cache public CV pages only"
    enabled     = true
    expression = join(" and ", [
      "http.host eq ${jsonencode(trimspace(var.cv_web_host))}",
      "http.request.method in {\"GET\" \"HEAD\"}",
      "starts_with(http.request.uri.path, \"/c/\")",
      "not starts_with(http.request.uri.path, \"/c/_preview/\")",
      "not starts_with(http.request.uri.path, \"/c/_internal/\")",
      "not starts_with(http.request.uri.path, \"/c/_next/\")",
      "http.request.uri.query eq \"\"",
    ])
    action_parameters = {
      cache = true
      browser_ttl = {
        mode = "respect_origin"
      }
      serve_stale = {
        disable_stale_while_updating = false
      }
    }
  }]
}
