import type { Token, Unit } from './types'

// Personal objects and dialogue attribution supply evidence even for dictionary words (e.g. Will).
const personalObjects = new Set(['meet', 'greet', 'call', 'name', 'see', 'tell', 'thank'])
const speech = new Set(['say', 'ask', 'reply', 'whisper', 'shout'])
const subjects = new Set([
  'i', 'you', 'we', 'he', 'she', 'it', 'they', 'there', 'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'my', 'our', 'your', 'his', 'her', 'its', 'their',
])
const nonNames = new Set([
  ...subjects, 'me', 'us', 'him', 'them', 'mine', 'ours', 'yours', 'hers', 'theirs',
  'who', 'whom', 'whose', 'which', 'what', 'where', 'when', 'why', 'how',
])

/** Evidence comes from the selected texts, including occurrences already understood by the reader. */
export function likelyNameTokens(units: readonly Unit[]): Set<Token> {
  const spellings = new Map<string, { tokens: Token[]; anchored: boolean }>()
  // A lexical use confirms the spelling recurs, but is never itself a name candidate.
  const lexicalModals = new Set<string>()
  for (const unit of units) {
    const punctuation = /[.!?…]/g
    let sentenceEnd = -1, question = false
    for (const [index, token] of unit.tokens.entries()) {
      const form = unit.text.slice(token.start, token.end)
      if (form === 'will' || form === 'may') {
        lexicalModals.add(form)
        continue
      }
      const titled = /^\p{Lu}\p{Ll}/u.test(form)
      // SRT joins lines in a cue, so a later speaker's label need not be the first token.
      const speaker = unit.start !== undefined && unit.text[token.end] === ':'
      if (!titled && !(speaker && /^\p{Lu}+$/u.test(form))) continue
      const key = form.toLowerCase().replace(/['’]s$/, '')
      if (nonNames.has(key)) continue // “Who said …?” is attribution, but not a name.
      const previous = unit.tokens[index - 1]
      const next = unit.tokens[index + 1]
      // A capital after punctuation (including at the start of quoted dialogue) is not an anchor.
      const preceding = previous && /^\s+$/.test(unit.text.slice(previous.end, token.start)) ? previous.lemma : ''
      const following = next && /^\s+$/.test(unit.text.slice(token.end, next.start)) ? next.lemma : ''
      // “Neris asked …” is evidence; “Never ask …” is not.
      const attribution = speech.has(following) && unit.text.slice(next.start, next.end).toLowerCase() !== following
      if (!preceding && following && (form === 'May' || form === 'Will')) {
        // A subtitle may contain several questions. Scan to each terminator at most once.
        if (token.start > sentenceEnd) {
          punctuation.lastIndex = token.end
          const mark = punctuation.exec(unit.text)
          sentenceEnd = mark?.index ?? unit.text.length
          question = mark?.[0] === '?'
        }
        if (subjects.has(following) || (question && !attribution && following !== 'may' && following !== 'will')) {
          lexicalModals.add(key)
          continue
        }
      }
      const hits = spellings.get(key) ?? { tokens: [], anchored: false }
      hits.tokens.push(token)
      const namedObject = preceding !== '' && (token.proper || personalObjects.has(preceding) || speech.has(preceding))
      hits.anchored ||= speaker || namedObject || attribution
      spellings.set(key, hits)
    }
  }
  const names = new Set<Token>()
  for (const [key, { tokens, anchored }] of spellings) {
    if (anchored && (tokens.length >= 2 || lexicalModals.has(key))) {
      for (const token of tokens) names.add(token)
    }
  }
  return names
}
