import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Cross-root z-index belongs to the portal, not to its popup or positioner.
 * Base UI appends nested portals to the nearest parent portal, so applying an
 * isolated semantic band here makes the same classes compose recursively.
 */
export const portalLayerVariants = cva('relative isolate', {
  variants: {
    layer: {
      floating: 'z-(--z-floating)',
      modal: 'z-(--z-modal)',
    },
  },
})

export type PortalLayerVariantProps = VariantProps<typeof portalLayerVariants>
