job [[ .my.job_name | quote ]] {
  datacenters = [[ .my.datacenters | toStringList ]]
  type        = "service"

  group "worker" {
    [[ if .my.enabled ]]
    count = 1
    [[ else ]]
    count = 0
    [[ end ]]

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
              destination_name = "postgres"
              local_bind_port  = 5432
            }

            upstreams {
              destination_name = "minio-api"
              local_bind_port  = 9000
            }

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

    task "pdf-worker" {
      driver = "docker"

      vault {}

      config {
        image    = [[ .my.docker_image | quote ]]
        shm_size = 536870912
      }

      env {
        MINIO_ENDPOINT             = "http://127.0.0.1:9000"
        MINIO_FORCE_PATH_STYLE     = "true"
        NATS_SERVER                = "nats://127.0.0.1:4222"
        PDF_HEARTBEAT_MILLISECONDS = "30000"
        POSTGRES_HOST              = "127.0.0.1"
        POSTGRES_MAX_CONNECTIONS   = "3"
        POSTGRES_PORT              = "5432"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/cv-pdf-worker/postgres-credentials" -}}
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
{{ with secret "secret/data/cv-pdf-worker/minio-credentials" -}}
MINIO_ACCESS_KEY_ID={{ .Data.data.access_key }}
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
{{ with secret "secret/data/cv-pdf-worker/nats-credentials" -}}
NATS_PASSWORD={{ .Data.data.password }}
NATS_USER={{ .Data.data.username }}
{{- end }}
EOH
        destination = "secrets/nats.env"
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

      kill_timeout = "45s"
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
