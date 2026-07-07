import { ProfileBlockList } from '@/components/cv/profile-blocks'
import { SectionShell } from '@/components/cv/section-shell'
import type { CvContent } from '@/cv-content/model'

type ProfileSectionProps = {
  section: Extract<CvContent['sections'][number], { type: 'profile' }>
}

export const ProfileSection = ({ section }: ProfileSectionProps) => {
  return (
    <SectionShell
      description={section.description ?? ''}
      id={section.id}
      index={section.index}
      title={section.label}
    >
      {section.items.map((item) => {
        return (
          <div
            className="cv-profile-section border-t border-border first:border-t-0"
            key={item.id}
          >
            <ProfileBlockList blocks={item.blocks} />
          </div>
        )
      })}
    </SectionShell>
  )
}
