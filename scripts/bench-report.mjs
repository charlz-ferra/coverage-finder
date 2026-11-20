import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  const json = JSON.parse(readFileSync(path, 'utf8'))
  return new Map(json.files.flatMap(file => file.groups.flatMap(group =>
    group.benchmarks.map(({ name, mean }) => [name, mean]))))
}
const [headPath, basePath] = process.argv.slice(2)
const current = read(headPath)
const base = basePath && existsSync(basePath) ? read(basePath) : new Map()
console.log('### Coverage Finder benchmarks\n')
console.log('| Scenario | Mean (ms) | Base (ms) | Change |\n| --- | ---: | ---: | ---: |')
for (const [name, mean] of current) {
  const before = base.get(name)
  const delta = before ? ((mean - before) / before * 100).toFixed(1) + '%' : '—'
  console.log(`| ${name.replace(/[\r\n|]/g, ' ')} | ${mean.toFixed(2)} | ${before?.toFixed(2) ?? '—'} | ${delta} |`)
}
