import { tokenizeUnit, type ParsedDoc } from '@coverage/core'
import { demoLibrary } from '@coverage/lang-en'
import { db, initialize, loadLibrary, readParsed, saveDocument, seedDemo, settings, type DocumentRecord } from './storage'
import type { LibraryState, ProgressDay, ReadingPosition, TestResult, WordEntry } from './types'
import { remainingSelection, type StudySelection } from './study-plan'

const schema = 'coverage-finder'
const invalid = () => new Error('Копия повреждена или имеет неизвестный формат. Проверьте выбранный JSON-файл.')
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const timestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max

export async function exportBackup(): Promise<string> {
  await initialize()
  return db.transaction('r', db.tables, async () => {
    const { profile, lastTest, studySelection } = await settings()
    const progress = await db.progress.toArray()
    const words = await db.words.toArray()
    const documents = []
    for (const doc of await db.documents.toArray()) {
      if (doc.isDemo) documents.push({ demo: doc.id, addedAt: doc.addedAt, reading: doc.reading })
      else {
        const { units } = await readParsed(doc)
        documents.push({
          id: doc.id, title: doc.title, hash: doc.hash, kind: doc.kind, addedAt: doc.addedAt, reading: doc.reading,
          units: units.map(({ text, start, end }) => ({ text, start, end }))
        })
      }
    }
    return JSON.stringify({ schema, version: 1, profile, words, documents, progress, lastTest, studySelection })
  })
}

function readProgress(value: unknown): ProgressDay {
  if (!object(value) || typeof value.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.day) ||
      !timestamp(value.knownCount) || !Array.isArray(value.readyTitles) ||
      !value.readyTitles.every(title => text(title, 1000))) throw invalid()
  return { day: value.day, knownCount: value.knownCount, readyTitles: value.readyTitles }
}

function readTest(value: unknown): TestResult | undefined {
  if (value === undefined) return
  if (!object(value) || !timestamp(value.size) || !timestamp(value.answeredAt) ||
      typeof value.falseAlarmRate !== 'number' || !Number.isFinite(value.falseAlarmRate) ||
      value.falseAlarmRate < 0 || value.falseAlarmRate > 1) throw invalid()
  return { size: value.size, answeredAt: value.answeredAt, falseAlarmRate: value.falseAlarmRate }
}

function readPosition(value: unknown): ReadingPosition | undefined {
  if (value === undefined) return
  if (!object(value) || !timestamp(value.page) || !timestamp(value.updatedAt) ||
      value.updatedAt > 8.64e15) throw invalid()
  return { page: value.page, updatedAt: value.updatedAt }
}

function readSelection(value: unknown, documentIds: Set<string>): StudySelection | undefined {
  if (value === undefined) return
  if (!object(value) || !Array.isArray(value.ids) || !value.ids.every(id => text(id, 1000)) ||
      value.ids.length !== new Set(value.ids).size ||
      !timestamp(value.limit) || value.limit < 1 || value.limit > 40) throw invalid()
  return remainingSelection({ ids: value.ids, limit: value.limit }, id => documentIds.has(id))
}

function readWord(value: unknown): WordEntry {
  if (!object(value) || !text(value.lemma, 256) || value.lemma !== value.lemma.toLowerCase() ||
      !timestamp(value.updatedAt) ||
      (value.status !== 'known' && value.status !== 'unknown' && value.status !== 'ignored') ||
      (value.source !== 'anki' && value.source !== 'click' && value.source !== 'test')) throw invalid()
  return { lemma: value.lemma, updatedAt: value.updatedAt, status: value.status, source: value.source }
}

function readUserDocument(value: Record<string, unknown>) {
  const { id, title, hash, kind, addedAt, units } = value
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash) || id !== 'file-' + hash ||
      !text(title, 1000) || !timestamp(addedAt) || !['srt', 'epub', 'txt'].includes(String(kind)) ||
      !Array.isArray(units) || !units.length) throw invalid()
  const parsed: ParsedDoc['units'] = []
  for (const value of units) {
    if (!object(value) || !text(value.text, 64 * 1024 * 1024)) throw invalid()
    const { start, end } = value
    const unit = tokenizeUnit(value.text)
    if (!unit) throw invalid()
    if (start !== undefined || end !== undefined) {
      if (typeof start !== 'number' || typeof end !== 'number' ||
          !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) throw invalid()
      unit.start = start
      unit.end = end
    }
    parsed.push(unit)
  }
  const record: DocumentRecord = { id, title, hash, kind: kind as ParsedDoc['kind'], addedAt, isDemo: false, author: '' }
  return { record, units: parsed }
}

export async function restoreBackup(json: string): Promise<LibraryState> {
  let data: unknown
  try { data = JSON.parse(json) } catch { throw invalid() }
  if (!object(data) || data.schema !== schema || data.version !== 1 ||
      (data.profile !== 'demo' && data.profile !== 'personal') ||
      !Array.isArray(data.words) || !Array.isArray(data.documents)) throw invalid()
  const profile = data.profile
  const lastTest = readTest(data.lastTest)
  if (data.progress !== undefined && !Array.isArray(data.progress)) throw invalid()
  const progress = (data.progress ?? []).map(readProgress)
  if (progress.length !== new Set(progress.map(row => row.day)).size) throw invalid()
  const words = data.words.map(readWord)
  if (words.length !== new Set(words.map(word => word.lemma)).size) throw invalid()
  const documents = data.documents.map((value: unknown) => {
    if (!object(value)) throw invalid()
    const reading = readPosition(value.reading)
    if ('demo' in value) {
      const demo = demoLibrary.find(doc => doc.id === value.demo)
      if (!demo || !timestamp(value.addedAt)) throw invalid()
      return { id: demo.id, demo, addedAt: value.addedAt, reading }
    }
    const upload = readUserDocument(value)
    return { id: upload.record.id, upload, reading }
  })
  const documentIds = new Set(documents.map(doc => doc.id))
  if (documents.length !== documentIds.size) throw invalid()
  const studySelection = readSelection(data.studySelection, documentIds)
  await db.transaction('rw', db.tables, async () => {
    const currentVersion = (await db.meta.get('library'))?.vocabVersion ?? 0
    for (const table of db.tables) await table.clear()
    const lastReadAt = documents.reduce((latest, doc) => Math.max(latest, doc.reading?.updatedAt ?? 0), 0)
    await db.meta.add({ key: 'library', profile, lastTest, lastReadAt, studySelection, vocabVersion: currentVersion + 1 })
    await db.words.bulkAdd(words)
    await db.progress.bulkAdd(progress)
    for (const item of documents) {
      if (item.demo) await seedDemo(item.demo, item.addedAt, item.reading)
      else if (item.upload) await saveDocument({ ...item.upload.record, reading: item.reading }, item.upload.units)
    }
  })
  return loadLibrary()
}
