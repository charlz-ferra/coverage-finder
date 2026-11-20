import type { DocStats, ParsedDoc, Pick as WordPick } from '@coverage/core'

export type WordStatus = 'known' | 'unknown' | 'ignored'
export const readerPageSize = 20

export interface ReadingPosition {
  /** Zero-based page in the document's ordered reading units. */
  page: number
  updatedAt: number
}

export interface ProgressDay {
  day: string
  knownCount: number
  readyTitles: string[]
}

export interface TestResult {
  size: number
  falseAlarmRate: number
  answeredAt: number
}
export interface WordEntry {
  lemma: string
  status: WordStatus
  source: 'anki' | 'test' | 'click'
  updatedAt: number
}

export interface LibraryDocument {
  id: string
  title: string
  author: string
  genre?: string
  year?: number
  source?: string
  kind: ParsedDoc['kind']
  isDemo: boolean
  addedAt: number
  reading?: ReadingPosition
  stats: DocStats
}

export interface LibraryState {
  documents: LibraryDocument[]
  words: WordEntry[]
  profile: 'demo' | 'personal'
  vocabVersion: number
  knownCount: number
}

export interface ReadingUnit {
  text: string
  start?: number
  end?: number
  tokens: { text: string; lemma: string; start: number; end: number; status: WordStatus; proper: boolean }[]
}

export interface Detail {
  document: LibraryDocument
  units: ReadingUnit[]
  picks: WordPick[]
  totalUnits: number
}
