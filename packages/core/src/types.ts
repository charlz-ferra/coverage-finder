export type DocumentKind = 'srt' | 'epub' | 'txt'
export type Lang = 'en'

export interface Token {
  /** UTF-16 offsets in Unit.text. */
  start: number
  end: number
  lemma: string
  proper: boolean
}

export interface Unit {
  text: string
  lemmas: string[]
  tokens: Token[]
  /** Subtitle times in seconds. */
  start?: number
  end?: number
}

export interface ParsedDoc {
  kind: DocumentKind
  title: string
  units: Unit[]
}

export interface DocStats {
  tokens: number
  sentences: number
  cTok: number
  cSent: number
  cI1: number
  band: 'ready' | 'effort' | 'early'
}

export interface Pick {
  word: string
  lemma: string
  unlocked: number
  frequency: number
  cSentAfter: number
  example: string
}
