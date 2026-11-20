import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const html = readFileSync('dist/index.html', 'utf8')
const entryFiles = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(match => match[1])
if (!entryFiles.length) throw new Error('No JavaScript entry found in dist/index.html')
const bytes = entryFiles.reduce((sum, path) => sum + gzipSync(readFileSync(resolve('dist', path))).length, 0)
console.log(`Initial JavaScript: ${(bytes / 1024).toFixed(1)} KiB gzip`)
if (bytes > 200 * 1024) process.exitCode = 1
const workers = readdirSync('dist/assets').filter(name => /^worker-.+\.js$/.test(name))
if (!workers.length) throw new Error('No analysis worker found in dist/assets')
const workerBytes = workers.reduce((sum, name) => sum + gzipSync(readFileSync(resolve('dist/assets', name))).length, 0)
console.log(`Analysis worker with English data: ${(workerBytes / 1024).toFixed(1)} KiB gzip`)
if (workerBytes > 3 * 1024 * 1024) process.exitCode = 1
