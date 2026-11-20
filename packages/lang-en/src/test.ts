import { frequencyWords } from './frequency'

export interface TestItem {
  word: string
  /** Real English lemmas have frequency bands from 1 to 10. */
  band: number | null
}

// Six items drawn across each thousand of the local ranked list.
const realWords = [
  'world', 'brother', 'voice', 'quiet', 'escape', 'crowd',
  'danger', 'bridge', 'pocket', 'rough', 'courage', 'circumstance',
  'museum', 'crawl', 'sensitive', 'routine', 'awkward', 'extend',
  'stitch', 'severe', 'scent', 'genuine', 'verdict', 'tremendous',
  'elbow', 'conceal', 'shallow', 'fortress', 'resemble', 'thorn',
  'baggage', 'debris', 'eerie', 'perceive', 'truce', 'undermine',
  'whim', 'hasty', 'jeopardize', 'feat', 'mellow', 'slander',
  'pebble', 'surpass', 'drastic', 'interval', 'invoke', 'turmoil',
  'granite', 'plight', 'customary', 'frail', 'obsolete', 'uncanny',
  'bystander', 'gullible', 'ravine', 'plummet', 'scrutiny', 'reverence',
]

// These pairs of fragments from English words were checked against the spelling dictionary,
// the full frequency source and the inflection table when building the dataset.
const invented = [
  ['bram', 'ple'], ['hol', 'ket'], ['blan', 'row'], ['les', 'ert'], ['shel', 'en'],
  ['rip', 'tern'], ['vel', 'per'], ['rip', 'den'], ['hol', 'per'], ['tun', 'den'],
  ['blan', 'vet'], ['bram', 'low'], ['wil', 'vet'], ['shel', 'vest'], ['glim', 'bon'],
  ['blan', 'vest'], ['shim', 'ble'], ['rib', 'son'], ['glim', 'tern'], ['brok', 'low'],
]

function createTest(): TestItem[] {
  const test: TestItem[] = realWords.map(word => ({
    word,
    band: 1 + Math.floor(frequencyWords.indexOf(word) / 1000),
  }))
  for (const [start, end] of invented) test.push({ word: start + end, band: null })
  // Fixed order across sessions allows an unfinished test to use indexed answers.
  let seed = 14177
  for (let i = test.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = Math.floor(seed / 0x100000000 * (i + 1))
    const temp = test[i]
    test[i] = test[j]
    test[j] = temp
  }
  return test
}

export const vocabularyTest = createTest()

export function estimateVocabulary(answers: readonly boolean[]): {
  known: string[]
  size: number
  falseAlarmRate: number
} {
  if (answers.length !== vocabularyTest.length || [...answers].some(answer => typeof answer !== 'boolean')) {
    throw new Error('Для оценки нужны ответы на все 80 слов.')
  }
  let falseAlarms = 0
  const tested = new Map<string, boolean>()
  for (const [index, item] of vocabularyTest.entries()) {
    if (item.band === null) {
      if (answers[index]) falseAlarms++
    } else {
      tested.set(item.word, answers[index])
    }
  }
  const falseAlarmRate = falseAlarms / invented.length
  const known: string[] = []
  for (let band = 1; band <= 10; band++) {
    const bandItems = vocabularyTest.filter(item => item.band === band)
    const confirmed = bandItems.filter(item => tested.get(item.word)).map(item => item.word)
    const hitRate = confirmed.length / bandItems.length
    const adjusted = falseAlarmRate === 1 ? 0 : Math.max(0, (hitRate - falseAlarmRate) / (1 - falseAlarmRate))
    const count = Math.round(adjusted * 1000)
    const words = frequencyWords.slice((band - 1) * 1000, band * 1000)
    // Within each band prefer explicit "yes" answers, then the most frequent untested lemmas.
    const ordered = [...confirmed, ...words.filter(word => !tested.has(word))]
    known.push(...ordered.slice(0, count))
  }
  return { known, size: known.length, falseAlarmRate }
}
