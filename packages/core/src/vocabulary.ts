import { tokenize } from './english'
import { plainMarkup } from './markup'
import type { Pick } from './types'

const separators: Record<string, string> = { tab: '\t', comma: ',', semicolon: ';', pipe: '|', colon: ':', space: ' ' }

function inferSeparator(text: string): string {
  const counts = new Map([['\t', 0], [',', 0], [';', 0]])
  let inQuotes = false
  for (const c of text) {
    if (c === '"') inQuotes = !inQuotes
    if (inQuotes) continue
    if (c === '\n' || c === '\r') break
    if (counts.has(c)) counts.set(c, counts.get(c)! + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0]
}

/** Parse quoted CSV and Anki's Notes in Plain Text, preserving newlines in quoted fields. */
export function parseVocabularyRows(input: string): string[][] {
  if (input.length > 24 * 1024 * 1024) throw new Error('Словарь превышает лимит 24 МБ.')
  let text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/^(?:[ ]*\n)+/, '')
  let separator: string | undefined
  let headerEnd = 0
  while (text[headerEnd] === '#') {
    const end = text.indexOf('\n', headerEnd)
    const directive = text.slice(headerEnd, end === -1 ? undefined : end)
    const spec = directive.match(/^#separator:(.+)$/i)
    if (spec) separator = separators[spec[1].trim().toLowerCase()]
    headerEnd = end < 0 ? text.length : end + 1
  }
  text = text.slice(headerEnd)
  separator ??= inferSeparator(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  function addRow() {
    row.push(field)
    if (row.some(value => value.trim())) rows.push(row)
    if (rows.length > 500_000) throw new Error('В словаре больше 500 000 строк. Разделите файл на части.')
    row = []
    field = ''
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"' && !field) inQuotes = true
    else if (c === separator) {
      row.push(field)
      if (row.length > 512) throw new Error('В строке словаря больше 512 колонок.')
      field = ''
    }
    else if (c === '\n') addRow()
    else field += c
  }
  if (inQuotes) throw new Error('В CSV осталась незакрытая кавычка.')
  addRow()
  return rows
}

export function vocabularyFromRows(rows: readonly (readonly string[])[], column = 0, skipHeader = false): string[] {
  const known = new Set<string>()
  for (let i = skipHeader ? 1 : 0; i < rows.length; i++) {
    const value = plainMarkup(rows[i][column] ?? '').replace(/\[sound:[^\]]+\]/gi, '').trim()
    const clozes = [...value.matchAll(/\{\{c\d+::([^{}]+?)\}\}/gi)]
    const words = clozes.length ? clozes.map(match => match[1].split('::')[0].trim()) : [value]
    for (const word of words) {
      const headword = word.replace(/^to\s+/i, '').trim()
      // A sentence/translation column must never silently become a vocabulary list.
      if (!/^[\p{Script=Latin}\p{M}]+(?:[-'’][\p{Script=Latin}\p{M}]+)*$/u.test(headword)) continue
      for (const token of tokenize(headword)) known.add(token.lemma)
    }
  }
  return [...known]
}

function csvCell(value: string): string {
  const safe = /^\s*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

export function exportAnkiCsv(picks: readonly (Pick & { sourceTitle?: string })[], sourceTitle = ''): string {
  const header = ['#separator:Comma', '#html:false', '#columns:Word,Lemma,Example,Source']
  const rows = picks.map(pick => [pick.word, pick.lemma, pick.example, pick.sourceTitle ?? sourceTitle].map(csvCell).join(','))
  return [...header, ...rows].join('\r\n') + '\r\n'
}
