import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { analyze, parseText, pickWords, tokenizeUnit } from '../src'
import type { ParsedDoc } from '../src'

describe('hand-counted sentence metrics', () => {
  const cases = [
    { text: 'Cat cat. Dog.', known: ['cat'], cTok: 2 / 3, cSent: 1 / 2, cI1: 1 / 2, first: 'dog' },
    { text: 'Cat cat. Cat dog.', known: [], cTok: 0, cSent: 0, cI1: 1 / 2, first: 'cat' },
    { text: 'The cats went. The cat studies.', known: ['the', 'cat', 'go'], cTok: 5 / 6, cSent: 1 / 2, cI1: 1 / 2, first: 'study' },
    { text: 'I see Zorvella.', known: ['i', 'see'], cTok: 1, cSent: 1, cI1: 0, first: undefined },
    { text: 'Dog cat. Cat. Dog dog dog dog.', known: [], cTok: 0, cSent: 0, cI1: 2 / 3, first: 'dog' },
    { text: 'A dog. A dog. A cat cat cat cat.', known: ['a'], cTok: 3 / 9, cSent: 0, cI1: 1, first: 'dog' },
  ]
  for (const fixture of cases) {
    it(fixture.text, () => {
      const doc = parseText(fixture.text)
      const known = new Set(fixture.known)
      const stats = analyze(doc, known)
      expect(stats.cTok).toBeCloseTo(fixture.cTok)
      expect(stats.cSent).toBeCloseTo(fixture.cSent)
      expect(stats.cI1).toBeCloseTo(fixture.cI1)
      expect(pickWords(doc, known, 1)[0]?.lemma).toBe(fixture.first)
    })
  }

  it('updates immediate gains only for affected sentences', () => {
    const doc = parseText('Dog. Cat dog. Cat dog. Bird.')
    const picks = pickWords(doc, new Set(), 20)
    expect(picks.map(p => [p.lemma, p.unlocked, p.cSentAfter])).toEqual([
      ['dog', 1, 0.25], ['cat', 2, 0.75], ['bird', 1, 1],
    ])
  })
  it('exports a surface form from the selected example', () => {
    const [pick] = pickWords(parseText('The cats chase birds. Cat.'), new Set(), 1)
    expect(pick).toMatchObject({ word: 'Cat', lemma: 'cat', example: 'Cat.' })
  })
  it('allows the user to override inferred names', () => {
    const doc = parseText('I see Zorvella.')
    const known = new Set(['i', 'see'])
    const override = new Set(['zorvella'])
    expect(analyze(doc, known, override).cSent).toBe(0)
    expect(pickWords(doc, known, 3, override).map(p => p.lemma)).toEqual(['zorvella'])
  })
  it('selects bands from unrounded token coverage at the boundary', () => {
    function covered(recognized: number) {
      const doc = parseText('cat '.repeat(recognized) + 'dog '.repeat(100 - recognized))
      return analyze(doc, new Set(['cat'])).band
    }
    expect([94, 95, 97, 98, 100].map(covered)).toEqual(['early', 'effort', 'effort', 'ready', 'ready'])
  })
})

it('satisfies coverage invariants and each recommended gain matches a fresh analysis', () => {
  const words = ['the', 'cat', 'dog', 'go', 'bird', 'run', 'tree']
  const word = fc.constantFrom(...words)
  fc.assert(fc.property(
    fc.array(fc.array(word, { minLength: 1, maxLength: 16 }), { minLength: 1, maxLength: 12 }),
    fc.subarray(words), word, (lines, vocabulary, next) => {
      const doc: ParsedDoc = { kind: 'txt', title: '', units: lines.map(line => tokenizeUnit(line.join(' '))!) }
      const known = new Set(vocabulary)
      const stats = analyze(doc, known)
      for (const n of [stats.cTok, stats.cSent, stats.cI1]) expect(n).toBeGreaterThanOrEqual(0)
      expect(stats.cTok).toBeLessThanOrEqual(1)
      expect(stats.cSent + stats.cI1).toBeLessThanOrEqual(1)
      const after = analyze(doc, new Set([...known, next]))
      expect(after.cTok).toBeGreaterThanOrEqual(stats.cTok)
      expect(after.cSent).toBeGreaterThanOrEqual(stats.cSent)
      let complete = Math.round(stats.cSent * stats.sentences)
      for (const pick of pickWords(doc, known, words.length)) {
        expect(known.has(pick.lemma)).toBe(false)
        known.add(pick.lemma)
        const fresh = analyze(doc, known)
        expect(pick.cSentAfter).toEqual(fresh.cSent)
        expect(complete + pick.unlocked).toBe(Math.round(fresh.cSent * fresh.sentences))
        complete += pick.unlocked
      }
      expect(analyze(doc, known).cSent).toBe(1)
    },
  ), { numRuns: 100 })
})
