job [[ .my.job_name | quote ]] {
  datacenters = [[ .my.datacenters | toStringList ]]
  type        = "service"

  group "worker" {
    count = 1

    network {
      mode = "bridge"
    }

    service {
      name = [[ .my.job_name | quote ]]

      connect {
        sidecar_service {
          disable_default_tcp_check = true

          proxy {
            upstreams {
              destination_name = "nats"
              local_bind_port  = 4222
            }
          }
        }

        sidecar_task {
          resources {
            cpu        = [[ .my.sidecar_resources.cpu ]]
            memory     = [[ .my.sidecar_resources.memory ]]
            memory_max = [[ .my.sidecar_resources.memory_max ]]
          }
        }
      }
    }

    task "cache-invalidator" {
      driver = "docker"

      vault {}

      config {
        image = [[ .my.docker_image | quote ]]
      }

      env {
        NATS_SERVER = "nats://127.0.0.1:4222"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/cv-cache-invalidator/nats-credentials" -}}
NATS_PASSWORD={{ .Data.data.password }}
NATS_USER={{ .Data.data.username }}
{{- end }}
EOH
        destination = "secrets/nats.env"
        env         = true
        change_mode = "restart"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/cv-cache-invalidator/runtime" -}}
CLOUDFLARE_CACHE_PURGE_API_TOKEN={{ .Data.data.cloudflare_cache_purge_api_token }}
CLOUDFLARE_ZONE_ID={{ .Data.data.cloudflare_zone_id }}
CV_WEB_HOST={{ .Data.data.cv_web_host }}
{{- end }}
EOH
        destination = "secrets/runtime.env"
        env         = true
        change_mode = "restart"
      }

      resources {
        cpu        = [[ .my.resources.cpu ]]
        memory     = [[ .my.resources.memory ]]
        memory_max = [[ .my.resources.memory_max ]]
      }

      restart {
        attempts = 5
        interval = "10m"
        delay    = "15s"
        mode     = "delay"
      }

      kill_timeout = "30s"
    }

    update {
      max_parallel     = 1
      min_healthy_time = "10s"
      healthy_deadline = "3m"
      auto_revert      = true
      canary           = 0
    }
  }
}
