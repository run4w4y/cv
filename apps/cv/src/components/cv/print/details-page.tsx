import {
  PrintEducation,
  PrintProject,
  PrintSkills,
} from '@/components/cv/print/entries'
import { PrintPage, PrintSectionTitle } from '@/components/cv/print/primitives'
import { cvSectionByType } from '@/cv-content/model'
import { useCvContent } from '@/lib/cv-document/hooks'

const PRINT_PROJECT_LIMIT = 8

export const PrintDetailsPage = () => {
  const content = useCvContent()
  const projects = cvSectionByType(content, 'projects')
  const skills = cvSectionByType(content, 'skills')
  const education = cvSectionByType(content, 'education')
  const printProjects = projects.items.slice(0, PRINT_PROJECT_LIMIT)

  return (
    <PrintPage>
      <PrintSectionTitle index={projects.index} title={projects.label} />
      <div className="grid grid-cols-2 gap-x-[5mm] gap-y-[3.2mm]">
        {printProjects.map((project, index) => (
          <PrintProject
            flushTop={index < 2}
            key={project.name}
            project={project}
          />
        ))}
      </div>

      <div className="mt-[4mm] grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-[5mm]">
        <section>
          <PrintSectionTitle index={skills.index} title={skills.label} />
          <PrintSkills section={skills} />
        </section>
        <section>
          <PrintSectionTitle index={education.index} title={education.label} />
          <PrintEducation section={education} />
        </section>
      </div>
    </PrintPage>
  )
}
