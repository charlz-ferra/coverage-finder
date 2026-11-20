import { bookUnits, makeUnit } from './english'
import { plainMarkup } from './markup'
import { decodeText } from './encoding'
import { parseEpub } from './epub'
import type { DocumentKind, Lang, ParsedDoc, Unit } from './types'

export const maxFileBytes = 24 * 1024 * 1024
const timing = /^(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{1,3})\s*-->\s*(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{1,3})(?:\s.*)?$/

function seconds(fields: string[]) {
  return Number(fields[0]) * 3600 + Number(fields[1]) * 60 + Number(fields[2]) + Number('0.' + fields[3])
}

function subtitles(text: string) {
  const units: Unit[] = []
  let tokenCount = 0
  for (const block of text.trim().split(/\n[ \t]*\n+/)) {
    const lines = block.trim().split('\n')
    const timingIndex = /^\d+$/.test(lines[0].trim()) ? 1 : 0
    const match = (lines[timingIndex] ?? '').trim().match(timing)
    if (!match) throw new Error('Некорректные таймкоды SRT. Проверьте формат субтитров.')
    const start = seconds(match.slice(1, 5))
    const end = seconds(match.slice(5, 9))
    if (end < start) throw new Error('Конец реплики SRT указан раньше начала.')
    const content = lines.slice(timingIndex + 1).join(' ').replace(/\{\\[^}]*\}/g, '')
    const unit = makeUnit(plainMarkup(content).replace(/\s+/g, ' ').trim())
    if (unit) {
      tokenCount += unit.tokens.length
      if (tokenCount > 1_000_000) throw new Error('В субтитрах больше миллиона слов. Разделите файл на части.')
      units.push({ ...unit, start, end })
    }
  }
  return units
}

function ensureContent(doc: ParsedDoc) {
  if (!doc.units.length) throw new Error('В файле не найден английский текст.')
  return doc
}

export function parseText(text: string, kind: 'txt' | 'srt' = 'txt', title = 'Текст'): ParsedDoc {
  if (text.length > maxFileBytes) throw new Error('Файл превышает лимит 24 МБ.')
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  return ensureContent({ kind, title, units: kind === 'srt' ? subtitles(text) : bookUnits(text) })
}

export function parse(file: Uint8Array, kind: DocumentKind, lang: Lang = 'en', title = 'Текст'): ParsedDoc {
  if (lang !== 'en') throw new Error('Для анализа доступен английский язык.')
  if (file.byteLength > maxFileBytes) throw new Error('Файл превышает лимит 24 МБ.')
  if (kind === 'txt' || kind === 'srt') return parseText(decodeText(file), kind, title)
  if (kind !== 'epub') throw new Error('Поддерживаются файлы SRT, TXT и EPUB.')
  try {
    return ensureContent(parseEpub(file, title))
  } catch (error) {
    if (error instanceof Error && /[а-яё]/i.test(error.message)) throw error
    throw new Error('Не удалось разобрать EPUB. Проверьте, что книга открывается и доступна без DRM.')
  }
}
