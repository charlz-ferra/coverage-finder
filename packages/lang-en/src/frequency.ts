import frequencyData from '../../../data/en/frequency.json'
import { isDictionaryWord, lemmatize } from './morphology'

function rankLemmas(): string[] {
  const counts = new Map<string, number>()
  for (const entry of frequencyData.split('\n')) {
    const separator = entry.indexOf(' ')
    const form = entry.slice(0, separator)
    if (!isDictionaryWord(form) || (form.length === 1 && form !== 'a' && form !== 'i')) continue
    const lemma = lemmatize(form)
    if (lemma.length === 1 && lemma !== 'a' && lemma !== 'i') continue
    const count = Number(entry.slice(separator + 1))
    counts.set(lemma, (counts.get(lemma) ?? 0) + count)
  }
  return [...counts.keys()]
    .sort((a, b) => counts.get(b)! - counts.get(a)! || (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, 10_000)
}

export const frequencyWords = rankLemmas()
