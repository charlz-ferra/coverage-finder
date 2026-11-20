import { isDictionaryWord, lemmatize } from '@coverage/lang-en/morphology'
import type { Token, Unit } from './types'

export { lemmatize }

const words = /\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*/gu
const maxTokens = 1_000_000
const shortForms: Record<string, string> = {
  "'m": 'be', "'re": 'be', "'ve": 'have', "'ll": 'will', "'d": 'would',
}
const subjects = new Set(['he', 'she', 'it', 'who', 'what', 'that', 'there', 'here', 'where', 'how', 'when', 'why'])
const negativeStems: Record<string, string> = { ca: 'can', wo: 'will', sha: 'shall', ai: 'be' }
const abbreviations = /\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|St|Capt|Lt|Gen|e\.g|i\.e)\.$/i
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('en', { granularity: 'sentence' }) : undefined

function splitWord(surface: string, offset: number, initial: boolean): Token[] {
  const form = surface.toLowerCase().replaceAll('’', "'")
  const suffix = form.match(/(n't|'m|'re|'ve|'ll|'d|'s)$/)?.[0]
  const stem = suffix ? form.slice(0, -suffix.length) : form
  const proper = !initial && /^[A-Z][a-z]/.test(surface) && !isDictionaryWord(stem)
  const lemma = (suffix === "n't" ? negativeStems[stem] : undefined) ?? lemmatize(stem)
  if (!lemma) return []

  const expansion = suffix === "n't" ? 'not' : suffix === "'s" && subjects.has(stem) ? 'be' : shortForms[suffix ?? '']
  if (!expansion) return [{ start: offset, end: offset + surface.length, lemma, proper }]
  const middle = offset + stem.length
  return [
    { start: offset, end: middle, lemma, proper },
    { start: middle, end: offset + surface.length, lemma: expansion, proper: false },
  ]
}

/** For Anki fields the calling code uses individual English words, including contractions. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let endOfWord = 0
  for (const match of text.matchAll(words)) {
    const start = match.index!
    const initial = !tokens.length || /[.?!…]["')\]]*\s+/.test(text.slice(endOfWord, start))
    tokens.push(...splitWord(match[0], start, initial))
    if (tokens.length > maxTokens) throw new Error('В тексте больше миллиона слов. Разделите файл на части.')
    endOfWord = start + match[0].length
  }
  return tokens
}

export function makeUnit(text: string): Unit | undefined {
  const tokens = tokenize(text)
  return tokens.length ? { text, tokens, lemmas: tokens.map(token => token.lemma) } : undefined
}

export function bookUnits(text: string, budget = maxTokens): Unit[] {
  const units: Unit[] = []
  function append(sentence: string) {
    const unit = makeUnit(sentence)
    if (!unit) return
    budget -= unit.tokens.length
    if (budget < 0) throw new Error('В тексте больше миллиона слов. Разделите файл на части.')
    units.push(unit)
  }
  // Blank lines retain paragraph boundaries. Hard wraps inside a paragraph are common in e-books.
  for (const paragraph of text.split(/\n\s*\n/)) {
    const line = paragraph.replace(/\s+/g, ' ').trim()
    if (!line) continue
    const segments = segmenter ? segmenter.segment(line) :
      (line.match(/[^.!?]+(?:[.!?]+["'”’)]*|$)/g) ?? [line]).map(segment => ({ segment }))
    let pending = ''
    for (const { segment } of segments) {
      const sentence = (pending + segment).trim()
      if (abbreviations.test(sentence)) {
        pending = sentence + ' '
        continue
      }
      pending = ''
      append(sentence)
    }
    if (pending) append(pending.trim())
  }
  return units
}
