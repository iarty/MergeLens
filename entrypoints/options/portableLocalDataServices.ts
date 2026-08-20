import type { PortableLocalDataSettingsServices } from '@/features/settings/PortableLocalDataSettings'
import { DexieLocalReviewRepository } from '@/modules/local-review'
import {
  createApplyPortableLocalDataImport,
  createExportPortableLocalData,
  createPreviewPortableLocalDataImport,
} from '@/modules/portable-local-data'
import { WxtReviewNotificationStateRepository } from '@/modules/review-notifications'
import { WxtWorkspacePreferencesRepository } from '@/modules/workspace-preferences'

const dependencies = {
  localReviewRepository: new DexieLocalReviewRepository(),
  workspacePreferencesRepository: new WxtWorkspacePreferencesRepository(),
  reviewNotificationRepository: new WxtReviewNotificationStateRepository(),
}

export const portableLocalDataServices: PortableLocalDataSettingsServices = {
  exportData: createExportPortableLocalData(dependencies),
  previewImport: createPreviewPortableLocalDataImport(dependencies),
  applyImport: createApplyPortableLocalDataImport(dependencies),
}
