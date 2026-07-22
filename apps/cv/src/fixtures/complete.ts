import { type CvDocumentV1, CvDocumentV1Schema } from '@cv/contracts/document'
import { Schema } from 'effect'

import completeDocumentJson from '../../fixtures/complete.document.json'

export const completeCvDocument: CvDocumentV1 =
  Schema.decodeUnknownSync(CvDocumentV1Schema)(completeDocumentJson)
