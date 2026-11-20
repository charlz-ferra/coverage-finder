import { expect, it } from 'vitest'
import { demoLibrary, frequencyWords } from '@coverage/lang-en'
import { analyze, makeStudyPlan, parseText, parseVocabularyRows } from '../src'

const docs = ['alice', 'oz'].map(id => {
  const book = demoLibrary.find(b => b.id === id)!
  return { id, ...parseText(book.text, book.kind, book.title) }
})
const vocabulary = new Set(frequencyWords.slice(0, 3000))
const percent = (count: number, n: number) => (100 * count / n).toFixed(1).replace('.', ',') + '%'

it('reproduces both 20-card plans and verifies each gain by learning only the displayed lemmas', async () => {
  const plans = [false, true].map(skipLikelyNames => {
    const plan = makeStudyPlan(docs, vocabulary, 20, new Set(), { skipLikelyNames })
    expect(plan).toMatchObject({ sentences: 113, understoodBefore: 42 })
    expect(plan.picks).toHaveLength(20)
    expect(parseVocabularyRows(plan.csv)).toEqual(plan.picks.map(p => [p.word, p.lemma, p.example, p.sourceTitle]))
    const learned = new Set(vocabulary)
    const counts = () => docs.map(doc => Math.round(analyze(doc, learned).cSent * doc.units.length))
    expect(counts()).toEqual(plan.documents.map(d => d.understoodBefore))
    let before = plan.understoodBefore
    for (const pick of plan.picks) {
      learned.add(pick.lemma)
      const after = counts().reduce((a, b) => a + b, 0)
      expect([pick.unlocked, pick.cSentAfter]).toEqual([after - before, after / plan.sentences])
      before = after
    }
    expect(counts()).toEqual(plan.documents.map(d => d.understoodAfter))
    expect(before).toBe(plan.understoodAfter)
    return plan
  })
  const [original, filtered] = plans
  const coverage = (n: number, before: number, after: number, filteredAfter: number) =>
    [before, after, filteredAfter].map(c => `${c}/${n} (${percent(c, n)})`).join(' | ')
  const report = [
    '# Два плана для «Алисы» и «Страны Оз»', '',
    'Демо-словарь: первые 3 000 лемм, без ручных отметок. Выбраны одни и те же два отрывка, в одном порядке, по 20 карточек. В колонках «Прирост» — предложения, которые открывает именно этот шаг.', '',
    '| Шаг | Без пропуска | Прирост | С пропуском вероятных имён | Прирост |',
    '| ---: | --- | ---: | --- | ---: |',
    ...original.picks.map((p, i) => `| ${i + 1} | ${p.lemma} | +${p.unlocked} | ${filtered.picks[i].lemma} | +${filtered.picks[i].unlocked} |`), '',
    '| Отрывок | Понятно сейчас | После, без пропуска | После, с пропуском |',
    '| --- | ---: | ---: | ---: |',
    ...original.documents.map((d, i) => `| ${d.title} | ${coverage(d.sentences, d.understoodBefore, d.understoodAfter, filtered.documents[i].understoodAfter)} |`),
    `| **Оба текста** | ${coverage(original.sentences, original.understoodBefore, original.understoodAfter, filtered.understoodAfter)} |`, '',
    'Воспроизвести: `pnpm --filter @coverage/core exec vitest run tests/demo-study-plan.test.ts`. [Как устроен отбор и почему меняется подборка](methodology.md#пропуск-вероятных-имён).', '',
  ].join('\n')
  await expect(report).toMatchFileSnapshot('../../../docs/demo-study-plan.md')
})
