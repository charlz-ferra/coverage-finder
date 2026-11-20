import { expect, it } from 'vitest'
import { demoLibrary, frequencyWords } from '@coverage/lang-en'
import { analyze, parseText } from '../src'
import type { DocStats } from '../src'

const format = (value: number) => (100 * value).toFixed(1).replace('.', ',')

function percentages(stats: DocStats) {
  return [stats.cTok, stats.cSent, stats.cI1].map(format).join(' / ')
}

it('reproduces the published demo comparison at three vocabulary sizes', async () => {
  const profiles = [3000, 5000, 8000].map(size => new Set(frequencyWords.slice(0, size)))
  const results = demoLibrary.map(book => {
    const doc = parseText(book.text)
    return { book, stats: profiles.map(known => analyze(doc, known)) }
  })
  results.sort((a, b) => b.stats[0].cSent - a.stats[0].cSent || a.book.title.localeCompare(b.book.title, 'en'))
  const rows = results.map(({ book, stats }) =>
    '| [' + book.title + '](' + book.source + ') | ' + stats[0].tokens + ' | ' + stats.map(percentages).join(' | ') + ' |')
  const report = [
    '# Демо-библиотека при трёх размерах словаря',
    '',
    'В таблице каждый отрывок оценён для трёх условных читателей. Им знакомы первые 3 000, 5 000 или 8 000 лемм английского частотного списка. Проценты описывают конкретный отрывок, объём которого указан во второй колонке.',
    '',
    'Три числа в ячейке — покрытие слов, доля полностью знакомых предложений и доля предложений с одной новой леммой, в процентах. Отрывки упорядочены по доле полностью знакомых предложений для профиля в 3 000 лемм. [Методика](methodology.md)',
    '',
    '| Источник отрывка | Токены | 3 000 лемм | 5 000 лемм | 8 000 лемм |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    'Сверить значения с текущими данными можно командой `pnpm --filter @coverage/core test`. Чтобы пересчитать таблицу после изменения данных или алгоритма, выполните `pnpm --filter @coverage/core exec vitest run tests/demo-ranking.test.ts -u`.',
    '',
  ].join('\n')
  await expect(report).toMatchFileSnapshot('../../../docs/demo-ranking.md')
})
