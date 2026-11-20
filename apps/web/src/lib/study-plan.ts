import { makeStudyPlan, type StudyPlan } from '@coverage/core'
import { db, documentById, initialize, readParsed, settings, vocabulary } from './storage'

export interface StudySelection {
  ids: string[]
  limit: number
  skipLikelyNames: boolean
}

export function remainingSelection(selection: StudySelection, keep: (id: string) => boolean): StudySelection | undefined {
  const ids = selection.ids.filter(keep)
  return ids.length >= 2 ? { ...selection, ids } : undefined
}

export async function getSavedStudySelection(): Promise<StudySelection | null> {
  await initialize()
  return (await settings()).studySelection ?? null
}

export async function getStudyPlan(
  ids: readonly string[], limit = 25, save = false, { skipLikelyNames } = { skipLikelyNames: false },
): Promise<StudyPlan> {
  if (typeof skipLikelyNames !== 'boolean') throw new Error('Некорректная настройка пропуска имён.')
  await initialize()
  // A single snapshot ensures imports, deletion and vocabulary changes cannot mix revisions.
  return db.transaction(save ? 'rw' : 'r', [db.meta, db.words, db.documents, db.sentences], async () => {
    const [meta, words] = await Promise.all([settings(), db.words.toArray()])
    const { known, unknown } = vocabulary(meta.profile, words)
    const uniqueIds = [...new Set(ids)]
    const docs = await Promise.all(uniqueIds.map(async id => {
      const record = await documentById(id)
      return { id, ...await readParsed(record) }
    }))
    const plan = makeStudyPlan(docs, known, limit, unknown, { skipLikelyNames })
    if (save) await db.meta.put({ ...meta, studySelection: { ids: uniqueIds, limit, skipLikelyNames } })
    return plan
  })
}
