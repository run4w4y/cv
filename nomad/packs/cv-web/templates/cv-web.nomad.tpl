job [[ .my.job_name | quote ]] {
  datacenters = [[ .my.datacenters | toStringList ]]
  type        = "service"

  group "web" {
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
      task = "web"
      port = "3000"

      tags = [
        "traefik.enable=true",
        "traefik.consulcatalog.connect=true",
        "traefik.subdomain=[[ .my.traefik_subdomain ]]",
        "traefik.http.routers.[[ .my.job_name ]].entrypoints=web"
      ]

      check {
        name     = "cv-web-live"
        type     = "http"
        expose   = true
        port     = "http"
        method   = "GET"
        path     = "/c/_internal/health"
        interval = "15s"
        timeout  = "3s"
      }

      connect {
        sidecar_service {
          proxy {
            upstreams {
              destination_name = "cv-registry"
              local_bind_port  = 3001
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

    task "web" {
      driver = "docker"

      config {
        image = [[ .my.docker_image | quote ]]
        ports = ["http"]
      }

      env {
        CV_DEPLOYMENT_ID        = [[ .my.deployment_id | quote ]]
        CV_PUBLIC_RESOLVER_URL  = "http://127.0.0.1:3001"
        HOSTNAME                = "0.0.0.0"
        NODE_ENV                = "production"
        PORT                    = "3000"
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
