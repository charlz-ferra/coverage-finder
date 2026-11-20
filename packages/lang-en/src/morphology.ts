import dictionaryData from '../../../data/en/dictionary.json'
import formData from '../../../data/en/forms.json'

const dictionary = new Set(dictionaryData.split(' '))
const forms = new Map<string, string>()
for (const entry of formData.split('\n')) {
  const separator = entry.indexOf(' ')
  forms.set(entry.slice(0, separator), entry.slice(separator + 1))
}

// Ambiguous forms are resolved without context. Prefer their frequent dictionary sense.
// For instance, "matter" in ordinary prose is rarely the comparative of "mat".
const unchanged = [
  'as', 'well', 'matter', 'number', 'evening', 'wedding', 'clothes', 'physics', 'ethics',
  'politics', 'economics', 'mathematics', 'statistics', 'news', 'glasses', 'headquarters',
  'means', 'ground', 'could', 'might', 'would', 'should', 'most', 'more', 'least', 'less',
  'bit', 'born', 'building', 'according', 'later', 'first', 'second', 'last', 'afterwards',
  'this', 'that', 'there', 'us', 'off', 'its', 'his', 'hers', 'theirs',
  'atlas', 'archer', 'bore', 'broker', 'buffer', 'candelabrum', 'ceiling', 'cola',
  'crew', 'dive', 'erasure', 'feed', 'flatter', 'laser', 'porter', 'wafer',
]
for (const word of unchanged) {
  forms.delete(word)
  dictionary.add(word)
}
forms.set('lives', 'life')
forms.set('better', 'good')
forms.set('best', 'good')
forms.set('worse', 'bad')
forms.set('worst', 'bad')

// Store terminal lemmas so that importing a lemma and clicking its surface form agree.
for (const [form, first] of forms) {
  let lemma = first
  while (forms.has(lemma) && forms.get(lemma) !== lemma) lemma = forms.get(lemma)!
  forms.set(form, lemma)
}

// Hunspell encodes some common words as affixes or only stores a capitalized spelling.
const additions = [
  'i', 'he', 'we', 'me', 'him', 'her', 'them', 'my', 'an', 'if', 'its', 'ours',
  'english', 'french', 'spanish', 'german', 'italian', 'russian', 'chinese', 'japanese',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'colour', 'favour', 'honour',
  'centre', 'metre', 'theatre', 'labour', 'neighbour', 'rumour', 'behaviour',
]
for (const word of additions) dictionary.add(word)

function normalize(word: string): string {
  return word.toLowerCase().trim().replace(/[’‘]/g, "'").replace(/'s$|'$/g, '')
}

export function lemmatize(word: string): string {
  const normalized = normalize(word)
  return forms.get(normalized) ?? normalized
}

export function isDictionaryWord(word: string): boolean {
  const normalized = normalize(word)
  return dictionary.has(normalized) || forms.has(normalized)
}
