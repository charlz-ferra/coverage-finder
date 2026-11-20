import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

const documents = [
  'LICENSE-DATA.md',
  'en/LICENSE-FORMS.txt', 'en/LICENSE-FREQUENCY.txt', 'en/LICENSE-SCOWL.txt',
  'en/forms.json', 'en/frequency.json', 'en/dictionary.json',
  'demo/LICENSE-GUTENBERG.txt', 'demo/library.json',
]

/** Distribute both the notices and the standalone machine-readable datasets. */
export function dataAttribution(): Plugin {
  const sources = new Map(documents.map(path => [
    `/data/${path}`,
    new URL(`../../data/${path}`, import.meta.url),
  ]))
  return {
    name: 'english-data-attribution',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        const file = sources.get(url)
        if (!file || (req.method !== 'GET' && req.method !== 'HEAD')) return next()
        res.setHeader('Content-Type', url.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8')
        res.end(req.method === 'HEAD' ? undefined : readFileSync(file))
      })
    },
    generateBundle() {
      for (const [path, file] of sources) {
        this.emitFile({ type: 'asset', fileName: path.slice(1), source: readFileSync(file) })
      }
    },
  }
}
