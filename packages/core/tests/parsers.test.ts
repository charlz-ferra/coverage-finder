import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { parse, parseText, tokenizeUnit } from '../src'

it('splits contractions and hyphens, retaining display offsets', () => {
  const unit = tokenizeUnit("It’s cold. I don't like snow-white coats.")!
  expect(unit.lemmas).toEqual(['it', 'be', 'cold', 'i', 'do', 'not', 'like', 'snow', 'white', 'coat'])
  expect(unit.tokens.map(t => unit.text.slice(t.start, t.end))).toEqual([
    'It', '’s', 'cold', 'I', 'do', "n't", 'like', 'snow', 'white', 'coats',
  ])
})

it('keeps titles and hard-wrapped prose inside their sentence', () => {
  expect(parseText('Dr. Bell went\nhome. Then he slept.').units.map(s => s.text))
    .toEqual(['Dr. Bell went home.', 'Then he slept.'])
  expect(() => parseText('123 456')).toThrow()
})

describe('subtitles', () => {
  const source = '\ufeff1\r\n00:00:01,200 --> 00:00:03.050\r\n{\\an8}<i>Hello</i>\r\nthere!\r\n\r\n2\r\n01:00:00,000 --> 01:01:02,999\r\nYes. I can.'
  it('preserves one unit per subtitle block and timing in seconds', () => {
    const doc = parse(strToU8(source), 'srt')
    expect(doc.units.map(s => [s.text, s.start, s.end])).toEqual([
      ['Hello there!', 1.2, 3.05], ['Yes. I can.', 3600, 3662.999],
    ])
  })
  it('decodes UTF-16 with BOM and Western subtitle encodings', () => {
    const bom = new Uint16Array([...source].map(c => c.charCodeAt(0)))
    expect(parse(new Uint8Array(bom.buffer), 'srt').units).toHaveLength(2)
    const bytes = new Uint8Array([0x49, 0x92, 0x6d, 0x21])
    expect(parse(bytes, 'txt').units[0].lemmas).toEqual(['i', 'be'])
  })
  it('rejects invalid times and binary input', () => {
    expect(() => parseText('1\n00:05:00,000 --> 00:00:00,000\nThis.', 'srt')).toThrow()
    expect(() => parse(new Uint8Array([0, 255]), 'txt')).toThrow()
  })
})

describe('EPUB reading order and bounds', () => {
  const book = {
    'OPS/two.xhtml': strToU8('<html><head><title>Skip me</title></head><body><p>Second.</p></body></html>'),
    'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>'),
    'OPS/book.opf': strToU8('<package><metadata><dc:title>My &amp; Your Book</dc:title></metadata><manifest><item id="b" href="two.xhtml" media-type="application/xhtml+xml"/><item id="a" href="sub/one%20chapter" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>'),
    'OPS/sub/one chapter': strToU8('<p onclick="skip">First <em>chapter</em> &amp; text.</p><script>not a sentence.</script>'),
  }
  it('uses OPF spine and decoded paths, extracts only visible text', () => {
    const doc = parse(zipSync(book), 'epub')
    expect(doc.title).toEqual('My & Your Book')
    expect(doc.units.map(s => s.text)).toEqual(['First chapter & text.', 'Second.'])
  })
  it('rejects missing, malformed and oversized archives', () => {
    expect(() => parse(strToU8('bad'), 'epub')).toThrow()
    expect(() => parse(zipSync({ empty: strToU8('no book') }), 'epub')).toThrow()
    expect(() => parse(new Uint8Array(24 * 1024 * 1024 + 1), 'epub')).toThrow()
    const oversized = zipSync({ 'extra': new Uint8Array(13 * 1024 * 1024), ...book })
    expect(() => parse(oversized, 'epub')).toThrow(/64 МБ/)
  })
})
