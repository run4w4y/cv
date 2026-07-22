job [[ .my.job_name | quote ]] {
  datacenters = [[ .my.datacenters | toStringList ]]
  type        = "batch"

  periodic {
    cron             = [[ .my.schedule | quote ]]
    time_zone        = "UTC"
    prohibit_overlap = true
    enabled          = [[ .my.enabled ]]
  }

  group "runner" {
    count = 1

    network {
      mode = "bridge"
    }

    reschedule {
      attempts  = 0
      unlimited = false
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

    task "listing-check-runner" {
      driver = "docker"

      vault {}

      config {
        image = [[ .my.docker_image | quote ]]

        [[ if and (empty .my.docker_image_username | not) (empty .my.docker_image_password | not) ]]
        auth {
          username = [[ .my.docker_image_username | quote ]]
          password = [[ .my.docker_image_password | quote ]]
        }
        [[ end ]]
      }

      env {
        LISTING_CHECK_BATCH_SIZE = [[ .my.listing_check_batch_size | quote ]]
        LISTING_CHECK_MODE       = [[ .my.listing_check_mode | quote ]]
        NATS_SERVER              = "nats://127.0.0.1:4222"
        POSTGRES_HOST            = "127.0.0.1"
        POSTGRES_MAX_CONNECTIONS = "4"
        POSTGRES_PORT            = "5432"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/cv-listing-checker/postgres-credentials" -}}
POSTGRES_DATABASE={{ .Data.data.database }}
POSTGRES_PASSWORD={{ .Data.data.password }}
POSTGRES_USER={{ .Data.data.username }}
{{- end }}
EOH
        destination = "secrets/postgres.env"
        env         = true
        change_mode = "noop"
      }

      template {
        data = <<EOH
{{ with secret "secret/data/cv-listing-checker/nats-credentials" -}}
NATS_PASSWORD={{ .Data.data.password }}
NATS_USER={{ .Data.data.username }}
{{- end }}
EOH
        destination = "secrets/nats.env"
        env         = true
        change_mode = "noop"
      }

      resources {
        cpu    = [[ .my.resources.cpu ]]
        memory = [[ .my.resources.memory ]]
      }

      restart {
        attempts = 0
        interval = "1m"
        delay    = "5s"
        mode     = "fail"
      }

      kill_timeout = "30s"
    }
  }
}
