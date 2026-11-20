import { Parser } from 'htmlparser2'

const ignored = new Set(['script', 'style', 'head', 'svg', 'math', 'template', 'noscript'])
const blocks = new Set(['p', 'div', 'br', 'li', 'section', 'article', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'tr'])

export function plainMarkup(input: string): string {
  if (!/[<&]/.test(input)) return input
  const parts: string[] = []
  let hidden = 0
  const parser = new Parser({
    onopentag(name) {
      if (ignored.has(name)) hidden++
      if (!hidden && blocks.has(name)) parts.push(name === 'br' ? '\n' : '\n\n')
    },
    onclosetag(name) {
      if (ignored.has(name)) hidden--
      if (!hidden && blocks.has(name) && name !== 'br') parts.push('\n\n')
    },
    ontext(text) { if (!hidden) parts.push(text) },
  }, { decodeEntities: true, recognizeSelfClosing: true })
  parser.end(input)
  return parts.join('')
}
