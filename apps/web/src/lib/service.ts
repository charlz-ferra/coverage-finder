import { analyze, exportAnkiCsv, maxFileBytes, parse, parseVocabularyRows, pickWords, vocabularyFromRows, type ParsedDoc } from '@coverage/core'
import { estimateVocabulary, vocabularyTest } from '@coverage/lang-en'
import { db, documentById, initialize, libraryDocument, loadLibrary, readParsed, saveDocument, settings, vocabulary } from './storage'
import { exportBackup, restoreBackup } from './backup'
import type { Detail, LibraryState, TestResult, WordEntry, WordStatus } from './types'

const duplicate = () => new Error('Этот файл уже есть в библиотеке.')

async function parseFile(file: File) {
  const kind = file.name.split('.').pop()?.toLowerCase()
  if (kind !== 'txt' && kind !== 'srt' && kind !== 'epub') throw new Error('Поддерживаются файлы TXT, SRT и EPUB.')
  if (file.size > maxFileBytes) throw new Error(`Максимальный размер файла — ${maxFileBytes / 1024 / 1024} МБ.`)
  await initialize()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
  if (await db.documents.where({ hash }).count()) throw duplicate()
  const parsed = parse(bytes, kind, 'en', file.name.replace(/\.[^.]+$/, ''))
  if (!parsed.units.length) throw new Error('В файле не найден английский текст.')
  return { hash, parsed }
}

async function commitFile({ hash, parsed }: { hash: string; parsed: ParsedDoc }) {
  await db.transaction('rw', db.documents, db.sentences, async () => {
    if (await db.documents.where({ hash }).count()) throw duplicate()
    await saveDocument({ id: 'file-' + hash, hash, title: parsed.title.trim().slice(0, 1000) || 'Текст',
      kind: parsed.kind, isDemo: false, author: '', addedAt: Date.now() }, parsed.units)
  })
  return loadLibrary()
}

async function addFile(file: File): Promise<LibraryState> {
  return commitFile(await parseFile(file))
}

// A cancellable import owns its worker. Persist only after the main thread confirms parsing completed.
let prepared: Awaited<ReturnType<typeof parseFile>> | undefined
async function prepareFile(file: File) { prepared = await parseFile(file) }
async function commitPrepared() {
  if (!prepared) throw new Error('Файл ещё не готов к сохранению.')
  const file = prepared
  prepared = undefined
  return commitFile(file)
}

async function removeDocument(id: string) {
  await initialize()
  await db.transaction('rw', db.documents, db.sentences, db.stats, async () => {
    await db.documents.delete(id)
    await db.sentences.where({ docId: id }).delete()
    await db.stats.delete(id)
  })
  return loadLibrary()
}

async function setWord(lemma: string, status: WordStatus) {
  await initialize()
  const normalized = lemma.trim().toLowerCase()
  if (!normalized || normalized.length > 256) throw new Error('Выберите английское слово.')
  await db.transaction('rw', db.words, db.meta, async () => {
    const existing = await db.words.get(normalized)
    if (existing?.source === 'click' && existing.status === status) return
    const meta = await settings()
    await db.words.put({ lemma: normalized, status, source: 'click', updatedAt: Date.now() })
    await db.meta.put({ ...meta, vocabVersion: meta.vocabVersion + 1 })
  })
  return loadLibrary()
}

function previewVocabulary(text: string) {
  const rows = parseVocabularyRows(text)
  return { rows: rows.slice(0, 8), columnCount: rows.reduce((count, row) => Math.max(count, row.length), 0) }
}

async function addWords(lemmas: string[], source: 'test' | 'anki', result?: TestResult) {
  await initialize()
  await db.transaction('rw', db.words, db.meta, async () => {
    const meta = await settings()
    if (source === 'test') await db.words.where('source').equals('test').delete()
    const existing = new Set(await db.words.toCollection().primaryKeys())
    const updatedAt = Date.now()
    const entries: WordEntry[] = [...new Set(lemmas)].filter(lemma => !existing.has(lemma))
      .map(lemma => ({ lemma, status: 'known', source, updatedAt }))
    // A confirmed Anki entry should survive a future re-estimation, including words in both lists.
    if (source === 'anki') {
      const imported = new Set(lemmas)
      await db.words.where('source').equals('test').filter(row => imported.has(row.lemma)).modify({ source, updatedAt })
    }
    await db.words.bulkAdd(entries)
    await db.meta.put({ ...meta, lastTest: result ?? meta.lastTest, profile: 'personal', vocabVersion: meta.vocabVersion + 1 })
  })
  return loadLibrary()
}

async function importVocabulary(text: string, column = 0, skipHeader = false) {
  const lemmas = vocabularyFromRows(parseVocabularyRows(text), column, skipHeader)
  if (!lemmas.length) throw new Error('В этой колонке не найдено английских слов.')
  return addWords(lemmas, 'anki')
}

function getTest() { return vocabularyTest.map(({ word }) => ({ word })) }
async function applyTest(answers: boolean[]) {
  if (answers.length !== vocabularyTest.length || answers.some(answer => typeof answer !== 'boolean'))
    throw new Error('Для оценки ответьте на все слова теста.')
  const { known, size, falseAlarmRate } = estimateVocabulary(answers)
  return addWords(known, 'test', { size, falseAlarmRate, answeredAt: Date.now() })
}

async function getProgress() { await initialize(); return db.progress.orderBy('day').toArray() }
async function getLastTest() { await initialize(); return (await settings()).lastTest ?? null }

async function getDetail(id: string, limit = 25, offset = 0, pageSize = 80): Promise<Detail> {
  await initialize()
  return db.transaction('r', db.tables, async () => {
    const [record, meta, words] = await Promise.all([documentById(id), settings(), db.words.toArray()])
    const { actual, known, unknown, ignored } = vocabulary(meta.profile, words)
    const parsed = await readParsed(record)
    const from = Math.max(0, Math.floor(offset))
    const size = Math.max(1, Math.floor(pageSize))
    return {
      document: libraryDocument(record, analyze(parsed, known, unknown)),
      totalUnits: parsed.units.length,
      units: parsed.units.slice(from, from + size).map(({ text, start, end, tokens }) => ({
        text, start, end,
        tokens: tokens.map(token => {
          const lemma = token.lemma
          const status = unknown.has(lemma) ? 'unknown' : actual.has(lemma) ? 'known' :
            ignored.has(lemma) || token.proper ? 'ignored' : 'unknown'
          return { ...token, text: text.slice(token.start, token.end), status }
        })
      })),
      picks: pickWords(parsed, known, Math.min(40, Math.max(0, Math.floor(limit))), unknown)
    }
  })
}

async function exportWords(id: string, limit = 25) {
  const detail = await getDetail(id, limit, 0, 1)
  return exportAnkiCsv(detail.picks, detail.document.title)
}

async function eraseData() {
  await db.transaction('rw', db.tables, async () => {
    const version = (await db.meta.get('library'))?.vocabVersion ?? 0
    for (const table of db.tables) await table.clear()
    await db.meta.add({ key: 'library', profile: 'personal', vocabVersion: version + 1 })
  })
  return loadLibrary()
}

export const service = {
  loadLibrary, addFile, prepareFile, commitPrepared, removeDocument, setWord, previewVocabulary, importVocabulary,
  getTest, applyTest, getLastTest, getProgress, getDetail, exportWords, exportBackup, restoreBackup, eraseData
}
