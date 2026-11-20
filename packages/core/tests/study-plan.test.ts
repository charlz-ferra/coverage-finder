import { describe, expect, it } from 'vitest'
import { makeStudyPlan, parseText, parseVocabularyRows } from '../src'

function text(id: string, body: string, title = id) {
  return { id, ...parseText(body, 'txt', title) }
}

describe('combined study plan', () => {
  it('prioritizes a word shared across texts and weights coverage by sentence count', () => {
    const first = text('a', 'I run. Dogs run.')
    const second = text('b', 'I run. I run. I run. I run. Dogs run. Cats run.')
    const plan = makeStudyPlan([first, second, first], new Set(['i', 'run']), 1)
    expect(plan).toMatchObject({ sentences: 8, understoodBefore: 5, understoodAfter: 7 })
    expect(plan.documents).toEqual([
      { id: 'a', title: 'a', sentences: 2, understoodBefore: 1, understoodAfter: 2 },
      { id: 'b', title: 'b', sentences: 6, understoodBefore: 4, understoodAfter: 5 },
    ])
    expect(plan.picks).toEqual([{
      word: 'Dogs', lemma: 'dog', unlocked: 2, frequency: 2, cSentAfter: 7 / 8,
      example: 'Dogs run.', sourceId: 'a', sourceTitle: 'a', documentCount: 2,
    }])
  })

  it('uses the actual chosen sentence and its own source in CSV, including escaped fields', () => {
    const book = text('one', 'Dogs play.', 'Early story')
    const episode = text('two', 'Dogs, dogs!', '=Episode "B"')
    const plan = makeStudyPlan([book, episode], new Set(), 2)
    expect(plan.picks.map(p => [p.lemma, p.sourceId, p.documentCount, p.unlocked])).toEqual([
      ['dog', 'two', 2, 1], ['play', 'one', 1, 1],
    ])
    expect(parseVocabularyRows(plan.csv)).toEqual([
      ['Dogs', 'dog', 'Dogs, dogs!', "'=Episode \"B\""],
      ['play', 'play', 'Dogs play.', 'Early story'],
    ])
  })

  it('projects manual overrides without modifying the vocabulary or parsed texts', () => {
    const docs = [text('a', 'I see Zorvella.'), text('b', 'I see Zorvella.')]
    const original = structuredClone(docs)
    const known = new Set(['i', 'see'])
    const unknown = new Set(['zorvella'])
    const plan = makeStudyPlan(docs, known, 40, unknown)
    expect(plan).toMatchObject({ understoodBefore: 0, understoodAfter: 2 })
    expect(plan.picks.map(p => p.lemma)).toEqual(['zorvella'])
    expect(docs).toEqual(original)
    expect([...known]).toEqual(['i', 'see'])
    expect([...unknown]).toEqual(['zorvella'])
  })

  it('returns complete coverage and an empty deck when every lemma is known', () => {
    const plan = makeStudyPlan([text('a', 'Dogs.'), text('b', 'Dog.')], new Set(['dog']), 40)
    expect(plan).toMatchObject({ sentences: 2, understoodBefore: 2, understoodAfter: 2, picks: [] })
    expect(parseVocabularyRows(plan.csv)).toEqual([])
  })

  it('requires distinct documents and a supported integer word count', () => {
    const a = text('one', 'Cats.')
    const b = text('two', 'Dogs.')
    expect(() => makeStudyPlan([a, a], new Set(), 1)).toThrow('два разных текста')
    for (const size of [0, 41, 1.5, NaN]) {
      expect(() => makeStudyPlan([a, b], new Set(), size)).toThrow('от 1 до 40')
    }
  })
})
