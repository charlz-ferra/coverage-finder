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

  it.each([false, true])('projects manual overrides without changing the dictionary or text (skip: %s)', skipLikelyNames => {
    const docs = [text('a', 'I see Zorvella.'), text('b', 'I see Zorvella.')]
    const original = structuredClone(docs)
    const known = new Set(['i', 'see'])
    const unknown = new Set(['zorvella'])
    const plan = makeStudyPlan(docs, known, 40, unknown, { skipLikelyNames })
    expect(plan).toMatchObject({ understoodBefore: 0, understoodAfter: 2 })
    expect(plan.picks.map(p => p.lemma)).toEqual(['zorvella'])
    expect(docs).toEqual(original)
    expect([...known]).toEqual(['i', 'see'])
    expect([...unknown]).toEqual(['zorvella'])
  })

  it('skips a recurring name without removing it from the sentences that still need it', () => {
    const docs = [text('a', 'I saw Zorvella. Zorvella ran. Zorvella hummed.'), text('b', 'I hummed.')]
    const known = new Set(['i', 'see', 'run'])
    const normal = makeStudyPlan(docs, known, 2)
    expect(normal.picks.map(p => p.lemma)).toEqual(['hum', 'zorvella'])
    const plan = makeStudyPlan(docs, known, 2, new Set(), { skipLikelyNames: true })
    expect(plan.picks.map(p => p.lemma)).toEqual(['hum'])
    expect(plan).toMatchObject({ sentences: 4, understoodBefore: 1, understoodAfter: 2 })
    expect(plan.documents.map(d => d.understoodAfter)).toEqual([1, 1])
    expect(plan.picks[0]).toMatchObject({ unlocked: 1, cSentAfter: 0.5, example: 'I hummed.' })
  })

  it.each(['May', 'Will'])('uses a lexical example for %s even when the name occurs first', name => {
    const modal = name.toLowerCase()
    const subject = name === 'May' ? 'I' : 'you'
    const known = new Set(['i', 'you', 'meet', 'say', 'hello', 'we', 'go'])
    const people = text('people', `I met ${name}. ${name} said hello.`)
    const dialogue = text('dialogue', `${name} ${modal} go. ${name} ${subject} go?`)
    const options = { skipLikelyNames: true }
    const plan = makeStudyPlan([people, dialogue], known, 20, new Set(), options)
    expect(plan.picks).toHaveLength(1)
    expect(plan.picks[0]).toMatchObject({ lemma: modal, word: modal, frequency: 2,
      example: `${name} ${modal} go.`, sourceId: 'dialogue' })
    expect(parseVocabularyRows(plan.csv)).toEqual([[modal, modal, `${name} ${modal} go.`, 'dialogue']])
    const onlyNames = makeStudyPlan([people, text('other', 'We go.')], known, 20, new Set(), options)
    expect(onlyNames).toMatchObject({ understoodBefore: 1, understoodAfter: 1, picks: [] })
  })

  it.each([
    ['Will', 'Will there be time?', 'Will', ['there', 'be', 'time']],
    ['Will', 'Will Alice come?', 'Will', ['alice', 'come']],
    ['Will', 'Will trains stop?', 'Will', ['train', 'stop']],
    ['May', 'May I go?', 'May', ['go']],
    ['Will', 'I will go.', 'will', ['go']],
  ] as const)('uses the modal in “%s” / “%s” rather than the single named object', (name, example, word, known) => {
    const docs = [text('person', `I met ${name}.`), text('modal', example)]
    const plan = makeStudyPlan(docs, new Set(['i', 'meet', ...known]), 1, new Set(), { skipLikelyNames: true })
    expect(plan.picks).toMatchObject([{ lemma: name.toLowerCase(), word, frequency: 1, example, sourceId: 'modal' }])
  })

  it('keeps a single named object without a second occurrence', () => {
    const docs = [text('a', 'I met Will.'), text('b', 'I go.')]
    const plan = makeStudyPlan(docs, new Set(['i', 'meet', 'go']), 1, new Set(), { skipLikelyNames: true })
    expect(plan.picks).toMatchObject([{ lemma: 'will', example: 'I met Will.' }])
  })

  it('keeps the interrogative subject of a speech verb', () => {
    const docs = [text('a', 'Who said that?'), text('b', 'Who left?')]
    const plan = makeStudyPlan(docs, new Set(['say', 'that', 'leave']), 1, new Set(), { skipLikelyNames: true })
    expect(plan.picks).toMatchObject([{ lemma: 'who', frequency: 2, unlocked: 2 }])
  })

  it('uses repeated speaker labels in subtitles, not every capital at a sentence boundary', () => {
    const episode = { id: 'ep', ...parseText(
      '1\n00:00:00,000 --> 00:00:01,000\nNeris: Go. Suddenly we wait.\n\n' +
      '2\n00:00:02,000 --> 00:00:03,000\nNeris: Wait.', 'srt', 'Episode') }
    const book = text('book', 'Suddenly we go. Finally we go. Finally we wait. Never say never.')
    const known = new Set(['we', 'wait', 'go', 'say'])
    const plan = makeStudyPlan([episode, book], known, 20, new Set(), { skipLikelyNames: true })
    expect(plan.picks.map(p => p.lemma).sort()).toEqual(['finally', 'never', 'suddenly'])
    expect(plan.documents.map(d => [d.understoodBefore, d.understoodAfter])).toEqual([[0, 0], [0, 4]])
  })

  it('skips both recurring speakers in joined subtitle lines', () => {
    const episode = { id: 'ep', ...parseText(
      '1\n00:00:00,000 --> 00:00:01,000\nSAM: Go.\nNERIS: Wait.\n\n' +
      '2\n00:00:02,000 --> 00:00:03,000\nSAM: Wait.\nNERIS: Go.', 'srt', 'Episode') }
    const docs = [episode, text('book', 'Go.')]
    const plan = makeStudyPlan(docs, new Set(['go', 'wait']), 20, new Set(), { skipLikelyNames: true })
    expect(plan).toMatchObject({ sentences: 3, understoodBefore: 1, understoodAfter: 1, picks: [] })
  })

  it('does not infer a name from repeated capitalized sentence openings or a single hit', () => {
    const docs = [text('a', 'Never ask twice. Never ask again.'), text('b', 'Finally I left. Finally I ran. Neris left. She said hello. She said hello.')]
    const known = new Set(['ask', 'twice', 'again', 'i', 'leave', 'run', 'say', 'hello'])
    const plan = makeStudyPlan(docs, known, 20, new Set(), { skipLikelyNames: true })
    expect(plan.picks.map(p => p.lemma).sort()).toEqual(['finally', 'neris', 'never', 'she'])
  })

  it('keeps the original surface form and example when name filtering is off', () => {
    const docs = [text('a', 'I call Zorvella zorvella.'), text('b', 'I call.')]
    const plan = makeStudyPlan(docs, new Set(['i', 'call']), 1)
    expect(plan.picks[0]).toMatchObject({ word: 'Zorvella', lemma: 'zorvella' })
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
