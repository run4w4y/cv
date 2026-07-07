import { SectionShell } from '@/components/cv/section-shell'
import { TechIcon } from '@/components/cv/tech-icon'
import { TechList } from '@/components/cv/tech-list'
import type { CvContent, SkillSubgroup } from '@/cv-content/model'

type SkillsSectionProps = {
  section: Extract<CvContent['sections'][number], { type: 'skills' }>
}

type SkillSubgroupItemProps = {
  subgroup: SkillSubgroup
}

const SkillSubgroupItem = ({ subgroup }: SkillSubgroupItemProps) => (
  <li
    className="flex flex-wrap items-center gap-x-1.5 gap-y-1"
    data-skill-subgroup={subgroup.group}
  >
    <span className="inline-flex items-center gap-1.5 text-foreground">
      <TechIcon name={subgroup.group} />
      <span>{subgroup.group}</span>
    </span>
    <span className="text-muted-foreground">{'・'}</span>
    {subgroup.items.map((item, index) => (
      <span
        className="inline-flex items-center gap-1.5 text-muted-foreground"
        data-skill-subitem={item}
        key={`${subgroup.group}:${item}`}
      >
        <TechIcon name={item} />
        <span>
          {item}
          {index < subgroup.items.length - 1 ? ',' : null}
        </span>
      </span>
    ))}
  </li>
)

export const SkillsSection = ({ section }: SkillsSectionProps) => {
  return (
    <SectionShell
      description={section.description ?? ''}
      id={section.id}
      index={section.index}
      title={section.label}
    >
      {section.items.map((skill) => {
        const items = skill.items ?? []
        const subgroups = skill.subgroups ?? []

        return (
          <div
            className="grid gap-4 border-b border-border p-6 last:border-b-0 md:grid-cols-[10rem_1fr] md:p-6"
            key={skill.group}
          >
            <h2 className="font-mono text-xs/5 text-muted-foreground">
              {skill.group}
            </h2>
            <div className="grid gap-2">
              {subgroups.length > 0 ? (
                <ul className="grid gap-2 font-mono text-xs/5 text-foreground">
                  {subgroups.map((subgroup) => (
                    <SkillSubgroupItem
                      key={subgroup.group}
                      subgroup={subgroup}
                    />
                  ))}
                </ul>
              ) : null}
              {items.length > 0 ? (
                <TechList className="text-xs/5 text-foreground" items={items} />
              ) : null}
            </div>
          </div>
        )
      })}
    </SectionShell>
  )
}
