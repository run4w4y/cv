job [[ .my.job_name | quote ]] {
  datacenters = [[ .my.datacenters | toStringList ]]
  type        = "service"

  group "api" {
    [[ if .my.enabled ]]
    count = 1
    [[ else ]]
    count = 0
    [[ end ]]

    network {
      mode = "bridge"

      port "http" {
        to = 3000
      }
    }

    service {
      name = [[ .my.job_name | quote ]]
      task = "api"
      port = "http"

      tags = [
        "traefik.enable=true",
        "traefik.consulcatalog.connect=true",
        "traefik.subdomain=[[ .my.traefik_subdomain ]]",
        "traefik.http.routers.[[ .my.job_name ]].entrypoints=web"
      ]

      check {
        name     = "registry-api-live"
        type     = "http"
        expose   = true
        method   = "GET"
        path     = "/health"
        interval = "15s"
        timeout  = "3s"
      }

      connect {
        sidecar_service {
          proxy {
            upstreams {
              destination_name = "postgres"
              local_bind_port  = 5432
            }

            upstreams {
              destination_name = "minio-api"
              local_bind_port  = 9000
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

    task "api" {
      driver = "docker"

      vault {}

      config {
        image = [[ .my.docker_image | quote ]]
        ports = ["http"]

        [[ if and (empty .my.docker_image_username | not) (empty .my.docker_image_password | not) ]]
        auth {
          username = [[ .my.docker_image_username | quote ]]
          password = [[ .my.docker_image_password | quote ]]
        }
        [[ end ]]
      }

      env {
        MINIO_ENDPOINT            = "http://127.0.0.1:9000"
        MINIO_FORCE_PATH_STYLE    = "true"
        POSTGRES_HOST             = "127.0.0.1"
        POSTGRES_MAX_CONNECTIONS  = [[ .my.postgres_max_connections | quote ]]
        POSTGRES_PORT             = "5432"
        REGISTRY_BFF_ENABLED      = [[ .my.bff_enabled | quote ]]
        SERVER_HOST               = "0.0.0.0"
        SERVER_PORT               = "3000"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/cv-registry/postgres-credentials" -}}
POSTGRES_DATABASE={{ .Data.data.database }}
POSTGRES_PASSWORD={{ .Data.data.password }}
POSTGRES_USER={{ .Data.data.username }}
{{- end }}
EOH
        destination = "secrets/postgres.env"
        env         = true
        change_mode = "restart"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/cv-registry/minio-credentials" -}}
MINIO_ACCESS_KEY_ID={{ .Data.data.access_key }}
MINIO_FACTS_BUCKET={{ .Data.data.facts_bucket }}
MINIO_OBJECTS_BUCKET={{ .Data.data.objects_bucket }}
MINIO_REGION={{ .Data.data.region }}
MINIO_SECRET_ACCESS_KEY={{ .Data.data.secret_key }}
{{- end }}
EOH
        destination = "secrets/minio.env"
        env         = true
        change_mode = "restart"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/cv-registry/runtime" -}}
CLOUDFLARE_ANALYTICS_API_TOKEN={{ .Data.data.cloudflare_analytics_api_token }}
CLOUDFLARE_GRAPHQL_ENDPOINT={{ .Data.data.cloudflare_graphql_endpoint }}
CLOUDFLARE_ZONE_ID={{ .Data.data.cloudflare_zone_id }}
CV_REVALIDATION_SECRET={{ .Data.data.cv_revalidation_secret }}
CV_REVALIDATION_URL={{ .Data.data.cv_revalidation_url }}
CV_WEB_HOST={{ .Data.data.cv_web_host }}
FACTS_PUBLISH_TOKEN={{ .Data.data.facts_publish_token }}
REGISTRY_API_TOKEN={{ .Data.data.registry_api_token }}
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
        attempts = 3
        interval = "5m"
        delay    = "10s"
        mode     = "delay"
      }

      kill_timeout = "30s"
    }

    update {
      max_parallel     = 1
      min_healthy_time = "15s"
      healthy_deadline = "3m"
      auto_revert      = true
      canary           = 0
    }
  }
}
