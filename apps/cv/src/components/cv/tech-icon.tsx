import { cn } from '@cv/ui/utils'
import angularjs from 'devicon/icons/angularjs/angularjs-plain.svg?url'
import ansible from 'devicon/icons/ansible/ansible-plain.svg?url'
import astro from 'devicon/icons/astro/astro-plain.svg?url'
import bun from 'devicon/icons/bun/bun-plain.svg?url'
import cloudflare from 'devicon/icons/cloudflare/cloudflare-plain.svg?url'
import consul from 'devicon/icons/consul/consul-original.svg?url'
import django from 'devicon/icons/django/django-plain.svg?url'
import docker from 'devicon/icons/docker/docker-plain.svg?url'
import fastapi from 'devicon/icons/fastapi/fastapi-plain.svg?url'
import github from 'devicon/icons/github/github-original.svg?url'
import githubactions from 'devicon/icons/githubactions/githubactions-plain.svg?url'
import gitlab from 'devicon/icons/gitlab/gitlab-plain.svg?url'
import go from 'devicon/icons/go/go-plain.svg?url'
import grafana from 'devicon/icons/grafana/grafana-plain.svg?url'
import haskell from 'devicon/icons/haskell/haskell-plain.svg?url'
import javascript from 'devicon/icons/javascript/javascript-plain.svg?url'
import jquery from 'devicon/icons/jquery/jquery-plain.svg?url'
import kubernetes from 'devicon/icons/kubernetes/kubernetes-plain.svg?url'
import nextjs from 'devicon/icons/nextjs/nextjs-plain.svg?url'
import nginx from 'devicon/icons/nginx/nginx-original.svg?url'
import nixos from 'devicon/icons/nixos/nixos-plain.svg?url'
import nodejs from 'devicon/icons/nodejs/nodejs-plain.svg?url'
import nomad from 'devicon/icons/nomad/nomad-original.svg?url'
import openapi from 'devicon/icons/openapi/openapi-plain.svg?url'
import opentelemetry from 'devicon/icons/opentelemetry/opentelemetry-plain.svg?url'
import playwright from 'devicon/icons/playwright/playwright-plain.svg?url'
import postcss from 'devicon/icons/postcss/postcss-original.svg?url'
import postgresql from 'devicon/icons/postgresql/postgresql-plain.svg?url'
import prometheus from 'devicon/icons/prometheus/prometheus-original.svg?url'
import python from 'devicon/icons/python/python-plain.svg?url'
import react from 'devicon/icons/react/react-original.svg?url'
import redis from 'devicon/icons/redis/redis-plain.svg?url'
import redux from 'devicon/icons/redux/redux-original.svg?url'
import rust from 'devicon/icons/rust/rust-original.svg?url'
import sqlalchemy from 'devicon/icons/sqlalchemy/sqlalchemy-plain.svg?url'
import storybook from 'devicon/icons/storybook/storybook-plain.svg?url'
import tailwindcss from 'devicon/icons/tailwindcss/tailwindcss-original.svg?url'
import tensorflow from 'devicon/icons/tensorflow/tensorflow-original.svg?url'
import terraform from 'devicon/icons/terraform/terraform-plain.svg?url'
import traefikproxy from 'devicon/icons/traefikproxy/traefikproxy-original.svg?url'
import typescript from 'devicon/icons/typescript/typescript-plain.svg?url'
import vault from 'devicon/icons/vault/vault-original.svg?url'
import vite from 'devicon/icons/vite/vite-original.svg?url'
import vitest from 'devicon/icons/vitest/vitest-plain.svg?url'
import wasm from 'devicon/icons/wasm/wasm-original.svg?url'
import webpack from 'devicon/icons/webpack/webpack-plain.svg?url'
import type { CSSProperties } from 'react'

type TechIconProps = {
  className?: string
  iconSlot?: 'inline-end' | 'inline-start'
  name: string
}

const techIconSources = {
  angularjs,
  ansible,
  astro,
  bun,
  cloudflare,
  consul,
  django,
  docker,
  fastapi,
  github,
  githubactions,
  gitlab,
  go,
  grafana,
  haskell,
  javascript,
  jquery,
  kubernetes,
  nextjs,
  nginx,
  nixos,
  nodejs,
  nomad,
  openapi,
  opentelemetry,
  playwright,
  postcss,
  postgresql,
  prometheus,
  python,
  react,
  redis,
  redux,
  rust,
  sqlalchemy,
  storybook,
  tailwindcss,
  tensorflow,
  terraform,
  traefikproxy,
  typescript,
  vault,
  vite,
  vitest,
  wasm,
  webpack,
} as const

type TechIconSlug = keyof typeof techIconSources

const techIconAliases: Record<string, TechIconSlug> = {
  Angular: 'angularjs',
  'Cloudflare Tunnel': 'cloudflare',
  'Consul Connect': 'consul',
  'Docker Compose': 'docker',
  GHCR: 'github',
  'GitHub Actions': 'githubactions',
  'GitLab CI': 'gitlab',
  K8s: 'kubernetes',
  Kubernetes: 'kubernetes',
  Nginx: 'nginx',
  Nix: 'nixos',
  Node: 'nodejs',
  'Node.js': 'nodejs',
  'Node/Bun': 'nodejs',
  'Nomad Pack': 'nomad',
  OTLP: 'opentelemetry',
  Postgres: 'postgresql',
  'Redis/ARQ': 'redis',
  Redux: 'redux',
  'Redux Toolkit': 'redux',
  SQL: 'postgresql',
  Tailwind: 'tailwindcss',
  'Tailwind CSS': 'tailwindcss',
  'Tailwind CSS v4': 'tailwindcss',
  'TensorFlow.js': 'tensorflow',
  'TensorFlow/Keras': 'tensorflow',
  'Terraform/OpenTofu': 'terraform',
  Traefik: 'traefikproxy',
  Wasm: 'wasm',
  'Wasm/WASI': 'wasm',
  'aide/OpenAPI': 'openapi',
}

const normalizeTechIconSlug = (name: string) =>
  name
    .replace(/\bv?\d+(?:\.\d+)*\b/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '')

const isTechIconSlug = (value: string): value is TechIconSlug =>
  Object.hasOwn(techIconSources, value)

export const getTechIcon = (name: string) => {
  const normalized = techIconAliases[name] ?? normalizeTechIconSlug(name)
  const slug = isTechIconSlug(normalized) ? normalized : undefined

  return slug ? { slug, source: techIconSources[slug] } : undefined
}

export const TechIcon = ({ className, iconSlot, name }: TechIconProps) => {
  const icon = getTechIcon(name)

  if (!icon) {
    return null
  }

  const mask = `url("${icon.source}") center / contain no-repeat`

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-3.5 shrink-0 bg-current align-[-0.125em]',
        className
      )}
      data-icon={iconSlot}
      data-tech-icon={icon.slug}
      style={
        {
          mask,
          WebkitMask: mask,
        } satisfies CSSProperties
      }
    />
  )
}
