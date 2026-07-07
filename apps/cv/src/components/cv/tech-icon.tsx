import { cn } from '@cv/ui/utils'
import devicons from 'devicon/devicon.json'

type TechIconProps = {
  className?: string
  iconSlot?: 'inline-end' | 'inline-start'
  name: string
}

type DeviconManifestIcon = {
  aliases?: Array<{ alias: string }>
  name: string
  versions: {
    font: string[]
  }
}

const deviconManifest = devicons as DeviconManifestIcon[]

const plainDeviconSlugSet = new Set(
  deviconManifest
    .filter(
      ({ aliases = [], versions }) =>
        versions.font.includes('plain') ||
        aliases.some(({ alias }) => alias === 'plain')
    )
    .map(({ name }) => name)
)

const deviconAliases: Record<string, string> = {
  Angular: 'angularjs',
  'Cloudflare Tunnel': 'cloudflare',
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
  'Consul Connect': 'consul',
  OTLP: 'opentelemetry',
  Postgres: 'postgresql',
  SQL: 'postgresql',
  S3: 'amazonwebservices',
  Tailwind: 'tailwindcss',
  'Tailwind CSS': 'tailwindcss',
  'Tailwind CSS v4': 'tailwindcss',
  'TensorFlow.js': 'tensorflow',
  'TensorFlow/Keras': 'tensorflow',
  Traefik: 'traefikproxy',
  Wasm: 'wasm',
  'Wasm/WASI': 'wasm',
}

const normalizeDeviconSlug = (name: string) =>
  name
    .replace(/\bv?\d+(?:\.\d+)*\b/g, '')
    .replace(/\bjs\b/gi, 'js')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

export const getTechIcon = (name: string) => {
  const slug = deviconAliases[name] ?? normalizeDeviconSlug(name)

  if (!plainDeviconSlugSet.has(slug)) {
    return undefined
  }

  return `devicon-${slug}-plain`
}

export const TechIcon = ({ className, iconSlot, name }: TechIconProps) => {
  const icon = getTechIcon(name)

  if (!icon) {
    return null
  }

  return (
    <i
      aria-hidden="true"
      className={cn(
        icon,
        'inline-block text-sm leading-none text-current align-middle',
        className
      )}
      data-icon={iconSlot}
    />
  )
}
