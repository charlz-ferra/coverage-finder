import type { DocStats, ParsedDoc, Pick, Token, Unit } from './types'

const empty: ReadonlySet<string> = new Set<string>()

export function isUnderstood(token: Token, known: ReadonlySet<string>, forceUnknown: ReadonlySet<string> = empty): boolean {
  return !forceUnknown.has(token.lemma) && (token.proper || known.has(token.lemma))
}

export function analyze(doc: ParsedDoc, known: ReadonlySet<string>, forceUnknown: ReadonlySet<string> = empty): DocStats {
  let tokens = 0
  let recognized = 0
  let understood = 0
  let plusOne = 0
  for (const unit of doc.units) {
    let firstMissing: string | undefined
    let severalMissing = false
    tokens += unit.tokens.length
    for (const token of unit.tokens) {
      if (isUnderstood(token, known, forceUnknown)) recognized++
      else if (firstMissing === undefined) firstMissing = token.lemma
      else if (firstMissing !== token.lemma) severalMissing = true
    }
    if (!firstMissing) understood++
    else if (!severalMissing) plusOne++
  }
  const sentences = doc.units.length
  const cTok = tokens ? recognized / tokens : 0
  return {
    tokens, sentences, cTok,
    cSent: sentences ? understood / sentences : 0,
    cI1: sentences ? plusOne / sentences : 0,
    band: cTok >= 0.98 ? 'ready' : cTok >= 0.95 ? 'effort' : 'early',
  }
}

interface Candidate {
  lemma: string
  frequency: number
  immediate: number
  units: number[]
}

function preferred(a: Candidate, b: Candidate) {
  // Relative frequency contributes less than a single complete sentence.
  if (a.immediate !== b.immediate) return a.immediate > b.immediate
  if (a.frequency !== b.frequency) return a.frequency > b.frequency
  return a.lemma < b.lemma
}

export function pickWords(doc: ParsedDoc, known: ReadonlySet<string>, k: number, forceUnknown: ReadonlySet<string> = empty): Pick[] {
  return rankWords(doc.units, known, k, forceUnknown, pick => pick)
}

// Keep the greedy policy identical for a single text and a group. A group additionally
// uses the original unit index to attribute each example, even when two units have the same text.
export function rankWords<T>(
  units: readonly Unit[], known: ReadonlySet<string>, k: number, forceUnknown: ReadonlySet<string>,
  describe: (pick: Pick, exampleIndex: number, occurrences: readonly number[]) => T,
  skipNames?: ReadonlySet<Token>,
): T[] {
  const eligible = (token: Token) => !skipNames?.has(token) || forceUnknown.has(token.lemma)
  const remaining: Set<string>[] = []
  const candidates = new Map<string, Candidate>()
  let understood = 0
  for (const [index, unit] of units.entries()) {
    const missing = new Set<string>()
    for (const token of unit.tokens) {
      if (isUnderstood(token, known, forceUnknown)) continue
      let entry = candidates.get(token.lemma)
      if (!entry) {
        entry = { lemma: token.lemma, frequency: 0, immediate: 0, units: [] }
        candidates.set(token.lemma, entry)
      }
      // Filtering controls cards, never the set of words still needed to understand a unit.
      if (eligible(token)) entry.frequency++
      if (!missing.has(entry.lemma)) entry.units.push(index)
      missing.add(entry.lemma)
    }
    remaining.push(missing)
    if (!missing.size) understood++
    if (missing.size === 1) candidates.get(missing.values().next().value!)!.immediate++
  }
  const picks: T[] = []
  const limit = Math.max(0, Math.floor(k))
  while (picks.length < limit && candidates.size) {
    let best: Candidate | undefined
    for (const candidate of candidates.values()) {
      if (candidate.frequency && (!best || preferred(candidate, best))) best = candidate
    }
    if (!best) break
    candidates.delete(best.lemma)
    let exampleIndex = -1
    let exampleSize = Infinity
    let word = ''
    for (const index of best.units) {
      const missing = remaining[index]
      if (missing.size < exampleSize) {
        const unit = units[index]
        const match = unit.tokens.find(t => t.lemma === best.lemma &&
          (!skipNames || (eligible(t) && !isUnderstood(t, known, forceUnknown))))
        if (match) {
          word = unit.text.slice(match.start, match.end)
          exampleIndex = index
          exampleSize = missing.size
        }
      }
      missing.delete(best.lemma)
      if (missing.size === 1) candidates.get(missing.values().next().value!)!.immediate++
    }
    understood += best.immediate
    const example = units[exampleIndex]
    picks.push(describe({
      lemma: best.lemma, word, frequency: best.frequency,
      unlocked: best.immediate, cSentAfter: understood / units.length, example: example.text,
    }, exampleIndex, best.units))
  }
  return picks
}
