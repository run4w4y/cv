import { useLingui } from '@lingui/react'
import { Footer } from '@/components/cv/footer'
import { Header } from '@/components/cv/header'
import { Hero } from '@/components/cv/hero'
import { getPrintPageStyle } from '@/components/cv/print/page-style'
import { PrintResume } from '@/components/cv/print/print-resume'
import { EducationSection } from '@/components/cv/sections/education-section'
import { ExperienceSection } from '@/components/cv/sections/experience-section'
import { ProfileSection } from '@/components/cv/sections/profile-section'
import { ProjectsSection } from '@/components/cv/sections/projects-section'
import { SkillsSection } from '@/components/cv/sections/skills-section'
import { PrivateCvStatus } from '@/components/private-cv/status'
import { cvMessages } from '@/i18n/messages'
import { useCvContent, useCvSession } from '@/lib/cv-document/hooks'

export const CvDocumentCore = () => {
  const content = useCvContent()
  const session = useCvSession()
  const { i18n } = useLingui()
  const renderSection = (section: (typeof content.sections)[number]) => {
    switch (section.type) {
      case 'profile':
        return <ProfileSection key={section.id} section={section} />
      case 'experience':
        return <ExperienceSection key={section.id} section={section} />
      case 'projects':
        return <ProjectsSection key={section.id} section={section} />
      case 'skills':
        return <SkillsSection key={section.id} section={section} />
      case 'education':
        return <EducationSection key={section.id} section={section} />
    }
  }

  return (
    <>
      <style>
        {getPrintPageStyle(
          content,
          {
            pageLabel: i18n._(cvMessages.labels.page),
          },
          session
        )}
      </style>
      <Header />
      <PrivateCvStatus />
      <div className="print-root print-hidden min-h-dvh bg-background">
        <main>
          <Hero />
          {content.sections.map(renderSection)}
        </main>
        <Footer />
      </div>
      <PrintResume />
    </>
  )
}
