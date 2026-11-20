import { isUnderstood, rankWords } from './metrics'
import { likelyNameTokens } from './plan-names'
import type { ParsedDoc, Pick } from './types'
import { exportAnkiCsv } from './vocabulary'

type SelectedDocument = ParsedDoc & { id: string }

export interface StudyPlanPick extends Pick {
  sourceId: string
  sourceTitle: string
  /** Number of selected documents where this lemma was initially unfamiliar. */
  documentCount: number
}

export interface StudyPlanDocument {
  id: string
  title: string
  sentences: number
  understoodBefore: number
  understoodAfter: number
}

export interface StudyPlan {
  sentences: number
  understoodBefore: number
  understoodAfter: number
  documents: StudyPlanDocument[]
  picks: StudyPlanPick[]
  /** Snapshot of the displayed recommendations, including the real source of each example. */
  csv: string
}

function understoodCount(doc: ParsedDoc, known: ReadonlySet<string>, unknown: ReadonlySet<string>) {
  let count = 0
  for (const unit of doc.units) {
    if (unit.tokens.every(token => isUnderstood(token, known, unknown))) count++
  }
  return count
}

export function makeStudyPlan(
  selection: readonly SelectedDocument[], known: ReadonlySet<string>, limit: number,
  unknown: ReadonlySet<string> = new Set(),
  { skipLikelyNames = false }: { skipLikelyNames?: boolean } = {},
): StudyPlan {
  const texts = [...new Map(selection.map(doc => [doc.id, doc])).values()]
  if (texts.length < 2) throw new Error('Выберите для плана хотя бы два разных текста.')
  if (!Number.isInteger(limit) || limit < 1 || limit > 40) throw new Error('Выберите от 1 до 40 слов.')

  const units = texts.flatMap(doc => doc.units)
  const owners = new Uint32Array(units.length)
  let offset = 0
  for (const [index, doc] of texts.entries()) {
    owners.fill(index, offset, offset + doc.units.length)
    offset += doc.units.length
  }
  const names = skipLikelyNames ? likelyNameTokens(units) : undefined
  const picks = rankWords(units, known, limit, unknown, (pick, exampleIndex, occurrences) => {
    const source = texts[owners[exampleIndex]]
    // Occurrences are unique unit indexes in text order, so changes of owner count distinct texts.
    let previous = -1
    let documentCount = 0
    for (const unitIndex of occurrences) {
      const owner = owners[unitIndex]
      if (owner !== previous) documentCount++
      previous = owner
    }
    return { ...pick, sourceId: source.id, sourceTitle: source.title, documentCount }
  }, names)

  const afterKnown = new Set(known)
  const afterUnknown = new Set(unknown)
  for (const { lemma } of picks) {
    afterKnown.add(lemma)
    afterUnknown.delete(lemma)
  }
  const documents = texts.map(doc => ({
    id: doc.id, title: doc.title, sentences: doc.units.length,
    understoodBefore: understoodCount(doc, known, unknown),
    understoodAfter: understoodCount(doc, afterKnown, afterUnknown),
  }))
  return {
    sentences: units.length,
    understoodBefore: documents.reduce((total, doc) => total + doc.understoodBefore, 0),
    understoodAfter: documents.reduce((total, doc) => total + doc.understoodAfter, 0),
    documents, picks, csv: exportAnkiCsv(picks),
  }
}
