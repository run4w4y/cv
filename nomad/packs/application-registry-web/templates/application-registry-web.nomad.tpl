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
        to = 8080
      }
    }

    service {
      name = [[ .my.job_name | quote ]]
      task = "web"
      port = "8080"

      tags = [
        "traefik.enable=true",
        "traefik.consulcatalog.connect=true",
        "traefik.subdomain=[[ .my.traefik_subdomain ]]",
        "traefik.http.routers.[[ .my.job_name ]].entrypoints=web"
      ]

      check {
        name     = "registry-web-live"
        type     = "http"
        expose   = true
        port     = "http"
        method   = "GET"
        path     = "/_health"
        interval = "15s"
        timeout  = "3s"
      }

      connect {
        sidecar_service {
          proxy {
            upstreams {
              destination_name = "cv-registry"
              local_bind_port  = 3000
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

      kill_timeout = "15s"
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
