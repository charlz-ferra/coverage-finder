import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { demoLibrary, estimateVocabulary, frequencyWords, isDictionaryWord, lemmatize, vocabularyTest } from '../src'

describe('English data', () => {
  it('has 10,000 different canonical lemmas', () => {
    expect(new Set(frequencyWords).size).toBe(10_000)
    expect(frequencyWords.map(lemmatize)).toEqual(frequencyWords)
    expect(frequencyWords.slice(0, 100)).toContain('be')
    expect(frequencyWords).not.toContain('alice')
  })

  it('uses 14 distinct attributed passages with complete narrative paragraphs', () => {
    expect(demoLibrary).toHaveLength(14)
    expect(new Set(demoLibrary.map(book => book.id)).size).toBe(14)
    for (const book of demoLibrary) {
      const minimum = ['brother', 'mice'].includes(book.id) ? 80 : 500
      expect(book.text.split(/\s+/).length).toBeGreaterThan(minimum)
      expect(book.text).not.toMatch(/\*\*\* (?:START|END)|Gutenberg/)
      expect(book.source).toMatch(/^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/)
    }
    expect(demoLibrary.find(book => book.id === 'brother')?.text).toMatch(/not have felt at all happy\.$/)
    expect(demoLibrary.find(book => book.id === 'mice')?.text).toMatch(/no one found to do it\.$/)
  })

  it('measures exact matches on the hand-labelled inflection sample', () => {
    const sample = readFileSync(new URL('./lemma-gold.txt', import.meta.url), 'utf8')
    const errors: string[] = []
    let count = 0
    for (const line of sample.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'))) {
      const [expected, ...forms] = line.split(' ')
      for (const form of forms) {
        count++
        const actual = lemmatize(form)
        if (actual !== expected) errors.push(`${form} → ${actual} (ожидалось ${expected})`)
      }
    }
    console.info(`Лемматизация: ${count - errors.length}/${count}; расхождения: ${errors.join(', ')}`)
    expect(count).toBeGreaterThan(240)
    expect((count - errors.length) / count).toBeGreaterThan(0.93)
    expect(lemmatize('DOG’S')).toBe('dog')
    expect(isDictionaryWord('Alice')).toBe(false)
    expect(isDictionaryWord('CLOCK')).toBe(true)
  })
})

describe('vocabulary estimator', () => {
  it('mixes six recognized lemmas per frequency band with twenty dictionary-checked pseudowords', () => {
    expect(vocabularyTest).toHaveLength(80)
    expect(new Set(vocabularyTest.map(item => item.word)).size).toBe(80)
    for (let band = 1; band <= 10; band++) {
      const items = vocabularyTest.filter(item => item.band === band)
      expect(items).toHaveLength(6)
      for (const item of items) expect(1 + Math.floor(frequencyWords.indexOf(item.word) / 1000)).toBe(band)
    }
    const pseudo = vocabularyTest.filter(item => item.band === null)
    expect(pseudo).toHaveLength(20)
    expect(pseudo.some(item => isDictionaryWord(item.word))).toBe(false)
  })

  it('returns exact frequency-band quantities and includes words answered affirmatively', () => {
    const answers = vocabularyTest.map(item => item.band !== null && item.band <= 3)
    const result = estimateVocabulary(answers)
    expect(result.size).toBe(3000)
    expect(new Set(result.known)).toEqual(new Set(frequencyWords.slice(0, 3000)))
    expect(result.falseAlarmRate).toBe(0)
  })

  it('corrects moderate false alarms without the all-yes division by zero', () => {
    const halfReal = new Set(Array.from({ length: 10 }, (_, i) =>
      vocabularyTest.filter(item => item.band === i + 1).slice(0, 3).map(item => item.word)).flat())
    const pseudo = vocabularyTest.filter(item => item.band === null).slice(0, 5)
    const result = estimateVocabulary(vocabularyTest.map(item => halfReal.has(item.word) || pseudo.includes(item)))
    expect(result.falseAlarmRate).toBe(0.25)
    expect(result.size).toBe(3330)
    expect([...halfReal].every(word => result.known.includes(word))).toBe(true)
    expect(estimateVocabulary(Array(80).fill(true))).toEqual({ known: [], size: 0, falseAlarmRate: 1 })
    expect(estimateVocabulary(Array(80).fill(false))).toEqual({ known: [], size: 0, falseAlarmRate: 0 })
    expect(() => estimateVocabulary([])).toThrow()
  })
})
