import Dexie, { type Table } from 'dexie'
import { analyze, parseText, type DocStats, type ParsedDoc } from '@coverage/core'
import { demoLibrary, frequencyWords } from '@coverage/lang-en'
import { readerPageSize, type LibraryDocument, type LibraryState, type ProgressDay, type ReadingPosition, type TestResult, type WordEntry } from './types'
import type { StudySelection } from './study-plan'

const chunkSize = 128

export interface DocumentRecord extends Omit<LibraryDocument, 'stats'> {
  hash: string
}
interface Chunk {
  docId: string
  part: number
  units: ParsedDoc['units']
}
interface StatsRecord {
  docId: string
  version: number
  stats: DocStats
}
export interface Settings {
  key: 'library'
  profile: LibraryState['profile']
  vocabVersion: number
  lastTest?: TestResult
  lastReadAt?: number
  studySelection?: StudySelection
}

class LibraryDatabase extends Dexie {
  words!: Table<WordEntry, string>
  documents!: Table<DocumentRecord, string>
  sentences!: Table<Chunk, [string, number]>
  stats!: Table<StatsRecord, string>
  meta!: Table<Settings, string>
  progress!: Table<ProgressDay, string>

  constructor() {
    super('coverage-finder')
    this.version(1).stores({
      words: 'lemma,source',
      documents: 'id,&hash',
      sentences: '[docId+part],docId',
      stats: 'docId',
      meta: 'key'
    })
    this.version(2).stores({ progress: 'day' })
  }
}

export const db = new LibraryDatabase()
export const sampleVocabulary = frequencyWords.slice(0, 3000)

export async function saveDocument(document: DocumentRecord, units: ParsedDoc['units']) {
  const chunks: Chunk[] = []
  for (let i = 0; i < units.length; i += chunkSize) {
    chunks.push({ docId: document.id, part: i / chunkSize, units: units.slice(i, i + chunkSize) })
  }
  // A newer bundled demo may have fewer sentences than the copy it was exported from.
  const reading = document.reading
  await db.documents.add(reading ? {
    ...document, reading: { ...reading, page: clampPage(reading.page, units.length) }
  } : document)
  await db.sentences.bulkAdd(chunks)
}

export async function seedDemo(demo: typeof demoLibrary[number], addedAt: number, reading?: ReadingPosition) {
  const { text, ...metadata } = demo
  const parsed = parseText(text, 'txt', metadata.title)
  await saveDocument({ ...metadata, isDemo: true, hash: 'demo:' + demo.id, addedAt, reading }, parsed.units)
}

function clampPage(page: number, unitCount: number): number {
  return Math.min(page, Math.max(0, Math.ceil(unitCount / readerPageSize) - 1))
}

/** Opening a reader touches its current position. Page changes are committed in request order. */
export async function rememberReading(id: string, page?: number): Promise<ReadingPosition> {
  if (page !== undefined && (!Number.isSafeInteger(page) || page < 0)) {
    throw new Error('Некорректный номер страницы.')
  }
  return db.transaction('rw', db.documents, db.sentences, db.meta, async () => {
    const [document, meta, lastChunk] = await Promise.all([
      documentById(id), settings(),
      db.sentences.where('[docId+part]').between([id, Dexie.minKey], [id, Dexie.maxKey]).last()
    ])
    const unitCount = lastChunk ? lastChunk.part * chunkSize + lastChunk.units.length : 0
    const reading = {
      page: clampPage(page ?? document.reading?.page ?? 0, unitCount),
      updatedAt: Math.max(Date.now(), (meta.lastReadAt ?? 0) + 1)
    }
    await db.documents.update(id, { reading })
    await db.meta.update(meta.key, { lastReadAt: reading.updatedAt })
    return reading
  })
}

export async function initialize() {
  await db.transaction('rw', db.tables, async () => {
    if (await db.meta.get('library')) return
    const now = Date.now()
    await db.meta.add({ key: 'library', profile: 'demo', vocabVersion: 1 })
    for (const demo of demoLibrary) await seedDemo(demo, now)
  })
}

export async function settings(): Promise<Settings> {
  const item = await db.meta.get('library')
  if (!item) throw new Error('Локальная библиотека не инициализирована.')
  return item
}

export function vocabulary(profile: LibraryState['profile'], words: WordEntry[]) {
  const actual = new Set(profile === 'demo' ? sampleVocabulary : [])
  const ignored = new Set<string>()
  const unknown = new Set<string>()
  for (const { lemma, status } of words) {
    if (status === 'known') actual.add(lemma)
    else {
      actual.delete(lemma)
      if (status === 'unknown') unknown.add(lemma)
      else ignored.add(lemma)
    }
  }
  return { actual, known: new Set([...actual, ...ignored]), ignored, unknown }
}

export async function readParsed(record: DocumentRecord): Promise<ParsedDoc> {
  const chunks = await db.sentences
    .where('[docId+part]').between([record.id, Dexie.minKey], [record.id, Dexie.maxKey]).toArray()
  return { kind: record.kind, title: record.title, units: chunks.flatMap(chunk => chunk.units) }
}

export async function documentById(id: string) {
  const record = await db.documents.get(id)
  if (!record) throw new Error('Текст больше не находится в библиотеке.')
  return record
}

export function libraryDocument(record: DocumentRecord, stats: DocStats): LibraryDocument {
  const { hash, ...metadata } = record
  void hash
  return { ...metadata, stats }
}

async function recordProgress(knownCount: number, documents: LibraryDocument[]) {
  const date = new Date()
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  const readyTitles = documents.filter(doc => doc.stats.band === 'ready').map(doc => doc.title).sort()
  const previous = await db.progress.where('day').belowOrEqual(day).last()
  if (previous?.knownCount === knownCount && previous.readyTitles.length === readyTitles.length &&
      previous.readyTitles.every((title, i) => title === readyTitles[i])) return
  await db.progress.put({ day, knownCount, readyTitles })
}

export async function loadLibrary(): Promise<LibraryState> {
  await initialize()
  return db.transaction('rw', db.tables, async () => {
    const [meta, words, records, cache] = await Promise.all([
      settings(), db.words.toArray(), db.documents.toArray(), db.stats.toArray()
    ])
    const { actual, known, unknown } = vocabulary(meta.profile, words)
    const cached = new Map(cache.map(row => [row.docId, row]))
    const documents: LibraryDocument[] = []
    for (const record of records) {
      const row = cached.get(record.id)
      let stats: DocStats
      if (row?.version === meta.vocabVersion) stats = row.stats
      else {
        stats = analyze(await readParsed(record), known, unknown)
        await db.stats.put({ docId: record.id, stats, version: meta.vocabVersion })
      }
      documents.push(libraryDocument(record, stats))
    }
    documents.sort((a, b) => b.stats.cSent - a.stats.cSent || b.stats.cTok - a.stats.cTok || a.title.localeCompare(b.title, 'en'))
    if (meta.profile === 'personal' && (words.length || documents.length || meta.lastTest)) {
      await recordProgress(actual.size, documents)
    }
    return { profile: meta.profile, vocabVersion: meta.vocabVersion, knownCount: actual.size, words, documents }
  })
}
