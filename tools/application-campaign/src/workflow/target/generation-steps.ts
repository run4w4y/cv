import { exportProfilePdfs, PdfUsageError } from '@cv/pdf-export'
import { mintPrivateContentLink } from '@cv/private-content-link'
import { Effect } from 'effect'
import type { ApplicationCampaignRuntime } from '../../runtime'
import { slugify } from '../../text'
import { type WorkflowStep, workflowOutput } from '../graph'
import {
  campaignPdfAssetsReadyKey,
  targetDecisionsKey,
  targetPdfPathKey,
  targetPrivateLinkKey,
} from '../keys'
import { campaignWorkflowStepIds, targetWorkflowStepId } from '../step-ids'
import type { TargetStepBuilderContext } from './model'

export type TargetGenerationSteps = {
  readonly privateLink?: WorkflowStep<ApplicationCampaignRuntime>
  readonly privatePdf?: WorkflowStep<ApplicationCampaignRuntime>
}

export const makeGenerationSteps = (
  context: TargetStepBuilderContext,
  recommend: WorkflowStep<ApplicationCampaignRuntime>
): TargetGenerationSteps => {
  const { options, targetRoutine } = context
  const { target } = targetRoutine
  const id = (step: string) => targetWorkflowStepId(target.index, step)
  const privateLinkRoutine = targetRoutine.privateLink
  const privateLink: WorkflowStep<ApplicationCampaignRuntime> | undefined =
    privateLinkRoutine.status === 'ready'
      ? {
          dependsOn: [recommend.id],
          execute: ({ outputs }) =>
            Effect.gen(function* () {
              const decisions = yield* outputs.get(targetDecisionsKey)
              const link = yield* mintPrivateContentLink({
                audience: decisions.audience,
                baseUrl: privateLinkRoutine.config.webBaseUrl,
                locale: options.locale,
                profile: decisions.profile,
              })
              return [workflowOutput(targetPrivateLinkKey, link)]
            }),
          failurePolicy: 'warn',
          id: id(campaignWorkflowStepIds.target.privateLink),
          label: 'Mint private CV link',
          scope: 'target',
        }
      : undefined
  const privatePdfRoutine = targetRoutine.privatePdf
  const privatePdf: WorkflowStep<ApplicationCampaignRuntime> | undefined =
    privateLink && privatePdfRoutine.status === 'ready'
      ? {
          dependsOn: [privateLink.id],
          execute: ({ outputs }) => {
            const link = outputs.getOption(targetPrivateLinkKey)
            if (link._tag === 'None') return Effect.succeed([])
            if (
              !options.skipBuild &&
              outputs.getOption(campaignPdfAssetsReadyKey)._tag === 'None'
            ) {
              return PdfUsageError.fail(
                'The shared CV asset build failed; private PDF export is unavailable.'
              )
            }

            return outputs.get(targetDecisionsKey).pipe(
              Effect.flatMap((decisions) =>
                exportProfilePdfs({
                  items: [
                    {
                      audienceId: link.value.audienceId,
                      locale: options.locale,
                      outputFileName: `cv-${options.locale}-${slugify(decisions.audience, 'application')}-${target.index + 1}.pdf`,
                      token: link.value.token,
                    },
                  ],
                  outputDir: options.pdfOutDir,
                  skipBuild: true,
                  webBaseUrl: privatePdfRoutine.config.webBaseUrl,
                })
              ),
              Effect.map((results) =>
                results[0]
                  ? [workflowOutput(targetPdfPathKey, results[0].outputPath)]
                  : []
              )
            )
          },
          failurePolicy: 'warn',
          id: id(campaignWorkflowStepIds.target.privatePdf),
          label: 'Export private PDF',
          scope: 'target',
        }
      : undefined

  return { privateLink, privatePdf }
}
