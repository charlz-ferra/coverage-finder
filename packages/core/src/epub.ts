import { Parser } from 'htmlparser2'
import { openArchive } from './archive'
import { decodeText } from './encoding'
import { plainMarkup } from './markup'
import { bookUnits } from './english'
import type { ParsedDoc } from './types'

function resolvePath(base: string, href: string): string {
  const ref = decodeURIComponent(href.split('#')[0])
  if (!ref || /^[a-z]+:|^\/|\\/.test(ref)) throw new Error('Неподдерживаемый путь к разделу EPUB.')
  const parts = base ? base.split('/').slice(0, -1) : []
  for (const part of ref.split('/')) {
    if (!part || part === '.') continue
    if (part !== '..') parts.push(part)
    else if (!parts.pop()) throw new Error('Некорректный путь к разделу EPUB.')
  }
  return parts.join('/')
}

export function parseEpub(bytes: Uint8Array, fallbackTitle: string): ParsedDoc {
  const read = openArchive(bytes)
  const xml = (path: string) => decodeText(read(path))
  let opf = ''
  new Parser({
    onopentag(name, attrs) {
      if (!opf && name.split(':').pop() === 'rootfile' && attrs['full-path']) opf = resolvePath('', attrs['full-path'])
    },
  }, { xmlMode: true }).end(xml('META-INF/container.xml'))
  if (!opf) throw new Error('В EPUB отсутствует описание книги.')

  const chapters = new Map<string, string>()
  const order: string[] = []
  let title = ''
  let inTitle = false
  new Parser({
    onopentag(tag, attrs) {
      const name = tag.split(':').pop()
      if (name === 'title' && !title) inTitle = true
      if (name === 'item' && attrs.id && attrs.href && /^(?:application\/xhtml\+xml|text\/html)$/i.test(attrs['media-type'])) {
        chapters.set(attrs.id, attrs.href)
      }
      if (name === 'itemref' && attrs.idref && attrs.linear !== 'no') order.push(attrs.idref)
    },
    ontext(text) { if (inTitle) title += text },
    onclosetag(tag) { if (tag.split(':').pop() === 'title') inTitle = false },
  }, { xmlMode: true }).end(xml(opf))
  const doc: ParsedDoc = { title: title.trim() || fallbackTitle, kind: 'epub', units: [] }
  let tokenCount = 0
  for (const id of order) {
    const href = chapters.get(id)
    if (!href) continue
    const chapter = plainMarkup(xml(resolvePath(opf, href)))
    for (const unit of bookUnits(chapter, 1_000_000 - tokenCount)) {
      tokenCount += unit.tokens.length
      doc.units.push(unit)
    }
  }
  return doc
}
