import type { LibraryDocument } from '../lib/client'

const numbers = new Intl.NumberFormat('ru-RU')
export const num = (value: number) => numbers.format(value)
const percentages = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
export function pct(value: number) {
  const percent = value * 100
  // Rounding a value just below a readiness threshold can contradict its label.
  const next = [95, 98, 100].find((limit) => percent < limit && percent >= limit - 0.05)
  if (next) return '<' + next + '%'
  if (percent > 0 && percent < 0.05) return '<0,1%'
  return percentages.format(percent) + '%'
}
export const bandNames = { ready: 'Можно читать', effort: 'С усилием', early: 'Пока рано' }
export const statusNames = { known: 'Знаю', unknown: 'Не знаю', ignored: 'Исключено' }
export const plural = (n: number, forms: [string, string, string]) => {
  const group = new Intl.PluralRules('ru').select(n)
  return forms[group === 'one' ? 0 : group === 'few' ? 1 : 2]
}
export const wordCount = (n: number) => num(n) + ' ' + plural(n, ['слово', 'слова', 'слов'])
export function cover(doc: LibraryDocument) {
  const key = doc.id.replace(/^demo[-:]/, '')
  return doc.isDemo &&
    [
      'alice',
      'oz',
      'sherlock',
      'treasure',
      'pride',
      'time',
      'little-women',
      'wild',
      'garden',
      'willows',
      'moby',
      'beauty',
      'brother',
      'mice',
    ].includes(key)
    ? import.meta.env.BASE_URL + 'art/' + key + '.webp'
    : ''
}
export function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
export async function readTextFile(file: File, max = 32 * 1024 * 1024) {
  if (file.size > max) throw new Error('Размер файла превышает допустимый предел.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const encoding =
    bytes[0] === 255 && bytes[1] === 254
      ? 'utf-16le'
      : bytes[0] === 254 && bytes[1] === 255
        ? 'utf-16be'
        : 'utf-8'
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    throw new Error('Сохраните файл в кодировке UTF-8 и повторите импорт.')
  }
}
