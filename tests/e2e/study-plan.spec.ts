import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'

async function checkAccessibility(page: Page) {
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(audit.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => ({ rule: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([])
}

async function checkDisplayedDeck(page: Page) {
  const cards = await page.locator('.plan-words details').evaluateAll(items => items.map(item =>
    ['.plan-word-form', 'summary strong', 'p[lang="en"]', '.plan-word-source']
      .map(selector => item.querySelector(selector)!.textContent!.trim())))
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать CSV для Anki' }).click()
  const download = await pending
  const rows = cards.map(fields => fields.map(s => '"' + s.replaceAll('"', '""') + '"').join(','))
  expect(await readFile((await download.path())!, 'utf8')).toBe([
    '#separator:Comma', '#html:false', '#columns:Word,Lemma,Example,Source', ...rows, '',
  ].join('\r\n'))
}

test('a joint plan weights sentences, remembers its selection and attributes each Anki example', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Загрузить словарь', exact: true }).click()
  await page.getByLabel('Файл словаря').setInputFiles({
    name: 'known.txt', mimeType: 'text/plain', buffer: Buffer.from('i\nrun'),
  })
  await page.getByRole('button', { name: 'Импортировать слова' }).click()
  await page.getByRole('button', { name: 'В библиотеку', exact: true }).click()
  await page.getByRole('button', { name: 'Добавить текст', exact: true }).click()
  await page.getByLabel('Файлы текстов').setInputFiles([
    { name: 'Episode A.txt', mimeType: 'text/plain', buffer: Buffer.from('I run. Dogs run. Owls run.') },
    { name: 'Episode B.txt', mimeType: 'text/plain', buffer: Buffer.from('I run. I run. I run. Dogs run. Cats run.') },
  ])
  await expect(page.getByRole('dialog').getByText('Добавлен', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Вернуться в библиотеку' }).click()
  await page.getByRole('link', { name: 'План слов', exact: true }).click()
  const calculate = page.getByRole('button', { name: 'Составить план' })
  await page.getByRole('checkbox', { name: 'Episode A' }).check()
  await expect(calculate).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Episode B' }).check()
  await page.getByLabel('Сколько слов подобрать').selectOption('10')
  await calculate.click()

  await expect(page.getByRole('heading', { name: 'Если выучить 3 слова' })).toBeVisible()
  await expect(page.locator('.plan-numbers dd')).toHaveText(['50%', '100%', '+4'])
  await expect(page.locator('.plan-impact li > span')).toHaveText(['33,3% → 100%', '60% → 100%'])
  await expect(page.locator('.plan-words summary strong')).toHaveText(['dog', 'cat', 'owl'])
  await page.locator('.plan-words summary').first().click()
  const shared = page.locator('.plan-words details').first()
  await expect(shared.locator('p')).toHaveText('Dogs run.')
  await expect(shared.locator('small')).toContainText('Episode A')
  await expect(shared.locator('small')).toContainText('2 из 2')
  await checkAccessibility(page)

  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать CSV для Anki' }).click()
  const csv = await pending
  expect(csv.suggestedFilename()).toBe('coverage-finder-study-plan.csv')
  expect((await readFile((await csv.path())!, 'utf8')).trimEnd().split(/\r?\n/).slice(3)).toEqual([
    '"Dogs","dog","Dogs run.","Episode A"',
    '"Cats","cat","Cats run.","Episode B"',
    '"Owls","owl","Owls run.","Episode A"',
  ])
  await page.reload()
  await expect(page.locator('.plan-numbers dd')).toHaveText(['50%', '100%', '+4'])
  await page.getByRole('button', { name: 'Изменить подборку' }).click()
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(2)
  await expect(page.getByRole('checkbox', { name: 'Episode A' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Episode B' })).toBeChecked()
  await expect(page.getByLabel('Сколько слов подобрать')).toHaveValue('10')
  await page.getByRole('button', { name:'Вернуться к плану' }).click()
  await page.locator('.plan-words summary').first().click()
  await page.getByRole('button', { name:'Знаю слово' }).click()
  await expect(page.locator('.plan-numbers dd')).toHaveText(['75%', '100%', '+2'])
  await expect(page.locator('.plan-words summary strong')).toHaveText(['cat', 'owl'])
  await page.locator('.plan-words summary').first().click()
  await page.getByRole('button', { name:'Не учитывать' }).click()
  await expect(page.locator('.plan-numbers dd')).toHaveText(['87,5%', '100%', '+1'])
  await expect(page.locator('.plan-words summary strong')).toHaveText(['owl'])
})

test('a filtered plan for uploaded TXT and SRT opens in the original mode from a legacy JSON backup', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Добавить текст', exact: true }).click()
  await page.getByLabel('Файлы текстов').setInputFiles([
    { name: 'Notebook.txt', mimeType: 'text/plain', buffer: Buffer.from('I see Neris. Neris ran.') },
    { name: 'Night shift.srt', mimeType: 'text/plain', buffer: Buffer.from(
      '1\n00:00:00,000 --> 00:00:01,000\nNERIS: Wait.\n\n2\n00:00:02,000 --> 00:00:03,000\n- I am gaunt.') },
  ])
  await expect(page.getByRole('dialog').getByText('Добавлен', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Вернуться в библиотеку' }).click()
  const planLink = page.getByRole('link', { name: 'План слов' })
  await planLink.click()
  await page.getByRole('checkbox', { name: 'Notebook' }).check()
  await page.getByRole('checkbox', { name: 'Night shift' }).check()
  const skip = page.getByRole('checkbox', { name: 'Пропускать вероятные имена', exact: true })
  await skip.check()
  await page.getByRole('button', { name: 'Составить план' }).click()
  const cards = page.locator('.plan-words summary strong')
  const stats = page.locator('.plan-numbers dd')
  await expect(cards).toHaveText(['gaunt'])
  await expect(stats).toHaveText(['25%', '50%', '+1'])
  await page.getByText('Посмотреть CSV', { exact: true }).click()
  const csv = page.getByRole('textbox', { name: 'Содержимое CSV для Anki' })
  const downloadingCsv = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать CSV для Anki' }).click()
  const csvFile = await downloadingCsv
  const bytes = await readFile((await csvFile.path())!, 'utf8')
  expect(bytes).toContain(`"gaunt","gaunt","'- I am gaunt.","Night shift"`)
  // HTML normalizes textarea line endings; apart from that this is the actual download.
  await expect(csv).toHaveValue(bytes.replaceAll('\r\n', '\n'))

  await page.getByRole('link', { name: 'Настройки' }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать JSON' }).click()
  const file = await downloading
  const backup = JSON.parse(await readFile((await file.path())!, 'utf8'))
  expect(backup.studySelection.skipLikelyNames).toBe(true)
  expect(backup.words).toEqual([])
  delete backup.studySelection.skipLikelyNames // version 1, as exported before the switch existed
  await page.getByLabel('Резервная копия JSON').setInputFiles({
    name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  })
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await planLink.click()
  await expect(cards).toHaveText(['neris', 'gaunt'])
  await expect(stats).toHaveText(['25%', '100%', '+3'])
  await page.getByRole('button', { name: 'Изменить подборку' }).click()
  await expect(skip).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Night shift' })).toBeChecked()
})

test('phone readers can skip names, keep the mode after reload and return to the original 20 cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#plan')
  const search = page.getByRole('searchbox', { name: 'Поиск текстов для плана' })
  await search.fill('alice')
  await page.getByRole('checkbox', { name: /Alice/ }).check()
  await search.fill('wizard')
  await page.getByRole('checkbox', { name: /Wizard/ }).check()
  const skip = page.getByRole('checkbox', { name: 'Пропускать вероятные имена', exact: true })
  const build = page.getByRole('button', { name: 'Составить план' })
  const edit = page.getByRole('button', { name: 'Изменить подборку' })
  const stats = page.locator('.plan-numbers dd')
  const words = page.locator('.plan-words summary strong')
  await expect(skip).toBeVisible()
  await expect(skip).not.toBeChecked()
  await checkAccessibility(page)
  await build.click()
  await expect(stats).toHaveText(['37,2%', '61,9%', '+28'])
  await expect(words).toHaveCount(20)
  const mode = page.locator('.plan-overview').getByRole('status')
  await expect(mode).toHaveText('Пропуск вероятных имён: выключен')
  await checkDisplayedDeck(page)
  const original = await words.allTextContents()
  expect([original[0], original[1], original[4]]).toEqual(['dorothy', 'dinah', 'toto'])

  await edit.click()
  await skip.check()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await build.click()
  await expect(stats).toHaveText(['37,2%', '57,5%', '+23'])
  await expect(page.locator('.plan-impact li > span')).toHaveText(['42,9% → 64,3%', '31,6% → 50,9%'])
  await expect(words).toHaveCount(20)
  await expect(mode).toHaveText('Пропуск вероятных имён: включён')
  await checkDisplayedDeck(page)
  const filtered = await words.allTextContents()
  expect(filtered.filter(lemma => !original.includes(lemma))).toEqual(['dreamy', 'gaunt', 'generally', 'glance'])
  expect(original.filter(lemma => !filtered.includes(lemma))).toEqual(['dorothy', 'dinah', 'toto', 'dearly'])
  await checkAccessibility(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload()
  await expect(words).toHaveText(filtered)
  await edit.click()
  await expect(skip).toBeChecked()
  await skip.uncheck()
  await page.getByRole('button', { name: 'Вернуться к плану' }).click()
  await expect(words).toHaveText(filtered)
  await edit.click()
  await expect(skip).toBeChecked()
  await skip.uncheck()
  await build.click()
  await expect(stats).toHaveText(['37,2%', '61,9%', '+28'])
  await page.reload()
  await expect(words).toHaveText(original)
})
