import { expect, it } from 'vitest'
import { exportAnkiCsv, parseVocabularyRows, vocabularyFromRows } from '../src'
import type { Pick } from '../src'

it('previews a whole table, imports a chosen column, resolves cloze notes and skips phrases', () => {
  const rows = parseVocabularyRows('\ufeff#separator:Tab\n#html:true\nTag\tWord\n1\t<b>studies</b>\n2\tto go\n3\tI see {{c1::dogs::animals}}.\n4\tThis is an entire sentence\n5\tgo')
  expect(rows).toHaveLength(6)
  expect(vocabularyFromRows(rows, 1, true)).toEqual(['study', 'go', 'dog'])
})

it('reads CSV quoting, escaped quotes, missing cells, CRLF and multiline fields', () => {
  expect(parseVocabularyRows('Word;Definition\r\nCat;"A ""feline"";\npet"\r\n;blank')).toEqual([
    ['Word', 'Definition'], ['Cat', 'A "feline";\npet'], ['', 'blank'],
  ])
  expect(parseVocabularyRows('\tword\n\tdog')).toEqual([['', 'word'], ['', 'dog']])
  expect(() => parseVocabularyRows('a,b\n"a,b')).toThrow(/кавычк/)
})

it('exports four Anki fields with quotes and protects formula-leading cells', () => {
  const pick: Pick = {
    lemma: 'cat', word: 'Cats', example: ' +3 cats, "here".', unlocked: 1, cSentAfter: 1, frequency: 3,
  }
  const csv = exportAnkiCsv([pick], '=source')
  expect(csv.startsWith('#separator:Comma\r\n#html:false')).toBe(true)
  expect(parseVocabularyRows(csv)).toEqual([['Cats', 'cat', "' +3 cats, \"here\".", "'=source"]])
})
