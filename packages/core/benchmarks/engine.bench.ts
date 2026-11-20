import { bench, describe } from 'vitest'
import { demoLibrary, frequencyWords } from '@coverage/lang-en'
import { analyze, parseText, pickWords } from '../src'

const alice = demoLibrary.find(doc => doc.id === 'alice')!.text
const excerpt = parseText(alice)
const tokensPerExcerpt = analyze(excerpt, new Set()).tokens
const source = (alice + '\n\n').repeat(Math.ceil(100_000 / tokensPerExcerpt))
const known = new Set(frequencyWords.slice(0, 3_000))
const doc = parseText(source)
const library = Array.from({ length: 50 }, (_, i) => parseText(demoLibrary[i % demoLibrary.length].text))
const options = { iterations: 5, time: 750, warmupTime: 100, warmupIterations: 1 }

describe('English corpus, local worker functions', () => {
  bench('parse and analyze 100k English tokens', () => { analyze(parseText(source), known) }, options)
  bench('recommend 40 lemmas from 100k tokens', () => { pickWords(doc, known, 40) }, options)
  bench('rerank 50 Gutenberg excerpts', () => { for (const text of library) analyze(text, known) }, options)
})
