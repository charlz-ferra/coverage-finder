import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const demoCount = JSON.parse(readFileSync(new URL('../../data/demo/library.json', import.meta.url), 'utf8')).length

const srt = '1\n00:00:01,000 --> 00:00:02,000\nI see birds.\n\n2\n00:00:03,000 --> 00:00:04,000\nBirds sing.\n\n3\n00:00:05,000 --> 00:00:06,000\nBirds sing and sing.'
const fileTitle = 'Garden conversation'

async function openLibrary(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Моя библиотека' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(demoCount)
}

async function importWords(page: Page) {
  await page.getByRole('button', { name: 'Загрузить словарь', exact: true }).click()
  await page.getByLabel('Файл словаря').setInputFiles({
    name: 'notes.tsv', mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('#separator:Tab\n#html:true\nTag\tWord\n1\tI\n2\tsee\n3\t<b>birds</b>\n4\tand'),
  })
  await page.getByLabel('Колонка со словами').selectOption({ label: 'Колонка 2' })
  await page.getByLabel('Пропустить заголовок').check()
  await expect(page.getByRole('dialog').getByRole('cell', { name: '<b>birds</b>' })).toBeVisible()
  await page.getByRole('button', { name: 'Импортировать слова' }).click()
  await expect(page.getByRole('dialog', { name: 'Словарь обновлён' })).toContainText('4 слова')
  await page.getByRole('button', { name: 'В библиотеку', exact: true }).click()
}

async function dropSubtitles(page: Page) {
  // Supply a real browser File so drag-and-drop, workers, hashing and persistence all run.
  await page.evaluate(({ source, name }) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([source], name, { type: 'application/x-subrip' }))
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }))
  }, { source: srt, name: fileTitle + '.srt' })
  await expect(page.getByRole('dialog')).toContainText('Добавлен')
  await page.getByRole('button', { name: 'Вернуться в библиотеку' }).click()
}

async function openUploaded(page: Page) {
  await page.getByRole('button', { name: /^Мои файлы/ }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: 'Открыть ' + fileTitle, exact: true }).click()
  await expect(page.getByRole('heading', { name: fileTitle, exact: true })).toBeVisible()
}

async function accessibility(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
    .map(v => ({ rule: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })) }))
  expect.soft(serious, screen).toEqual([])
}

test('import, rank, inspect, export a contextual card and persist a manual correction', async ({ page, context }) => {
  await openLibrary(page)
  await page.waitForLoadState('networkidle')
  const workerUrls = new Set(page.workers().map(worker => worker.url()))
  const unexpected: string[] = []
  context.on('request', request => {
    const url = new URL(request.url())
    if (!['http:', 'https:'].includes(url.protocol)) return
    // Import cancellation uses a second instance of the same bundled worker.
    if (request.method() === 'GET' && workerUrls.has(url.href) && !request.postData()) return
    unexpected.push(request.method() + ' ' + url.href)
  })
  await importWords(page)
  await dropSubtitles(page)
  await openUploaded(page)
  const metrics = page.locator('.metrics-row')
  await expect(metrics).toContainText('66,7%')
  await expect(metrics).toContainText('33,3%')
  await expect(page.locator('.timestamp')).toHaveText(['0:01', '0:03', '0:05'])
  await expect(page.locator('.pick-list summary strong')).toHaveText(['sing'])

  await page.getByRole('button', { name: 'Экспорт в Anki' }).click()
  await expect(page.getByRole('dialog').getByRole('row')).toHaveCount(2)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать CSV' }).click()
  const csv = await pending
  expect(csv.suggestedFilename()).toContain(fileTitle)
  expect(await readFile((await csv.path())!, 'utf8')).toContain('"sing","sing","Birds sing.","Garden conversation"')
  await page.getByRole('button', { name: 'sing', exact: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Знаю', exact: true }).click()
  await expect(metrics.locator('strong')).toHaveText(['100%', '100%', '0%'])
  expect(unexpected).toEqual([])
  await page.reload()
  await expect(metrics.locator('strong')).toHaveText(['100%', '100%', '0%'])
})

test('backup restores imported subtitles, vocabulary and ranking after erasure', async ({ page }) => {
  await openLibrary(page)
  await importWords(page)
  await dropSubtitles(page)
  await page.getByRole('link', { name: 'Настройки' }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать JSON' }).click()
  const backup = await downloading
  const saved = await readFile((await backup.path())!)
  expect(JSON.parse(saved.toString()).documents).toHaveLength(demoCount + 1)
  await page.getByRole('button', { name: 'Удалить всё' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('navigation').getByRole('link', { name: 'Библиотека' }).click()
  await expect(page.getByRole('heading', { name: 'Тексты не найдены' })).toBeVisible()
  await page.getByRole('link', { name: 'Настройки' }).click()
  await page.getByLabel('Резервная копия JSON').setInputFiles({ name: 'library.json', mimeType: 'application/json', buffer: saved })
  await page.getByRole('dialog').getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('navigation').getByRole('link', { name: 'Библиотека' }).click()
  await openUploaded(page)
  await expect(page.locator('.metrics-row strong')).toHaveText(['66,7%', '33,3%', '66,7%'])
})

test('file picker imports an EPUB and exports exactly twenty four-field Anki cards', async ({ page }) => {
  await openLibrary(page)
  await importWords(page)
  await page.getByRole('button', { name: 'Добавить текст', exact: true }).click()
  const chosen = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Выберите или перетащите файлы/ }).click()
  await (await chosen).setFiles(fileURLToPath(new URL('./fixtures/coastal-notebook.epub', import.meta.url)))
  await expect(page.getByRole('dialog')).toContainText('Добавлен')
  await page.getByRole('button', { name: 'Вернуться в библиотеку' }).click()
  await page.getByRole('button', { name: 'Открыть Coastal Notebook', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Coastal Notebook' })).toBeVisible()
  await expect(page.locator('.reading-text')).toContainText('A copper lantern swung beside the harbour gate.')
  await page.getByLabel('Размер подборки').selectOption({ label: '20 слов' })
  await expect(page.locator('.pick-list li:visible')).toHaveCount(5)
  await page.getByRole('button', { name: 'Показать все 20 слов' }).click()
  await expect(page.locator('.pick-list li:visible')).toHaveCount(20)
  await page.getByRole('button', { name: 'Экспорт в Anki' }).click()
  const preview = page.getByRole('dialog').locator('tbody tr')
  await expect(preview).toHaveCount(20)
  const cards = await preview.evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll('td'), cell => cell.textContent)))
  expect(new Set(cards.map(card => card[1])).size).toBe(20)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать CSV' }).click()
  const csv = await downloading
  const lines = (await readFile((await csv.path())!, 'utf8')).trimEnd().split(/\r?\n/)
  expect(lines.slice(0, 3)).toEqual(['#separator:Comma', '#html:false', '#columns:Word,Lemma,Example,Source'])
  expect(lines.slice(3)).toHaveLength(20)
  for (const [i, line] of lines.slice(3).entries()) {
    // Every card in this fixture has a single-line example. Verify quoting even for commas and dialogue.
    const match = line.match(/^"((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)"$/)
    expect(match).not.toBeNull()
    const values = match!.slice(1).map(value => value.replaceAll('""', '"'))
    expect(values).toEqual(cards[i])
    const [form, lemma, example, source] = values
    expect(form.length).toBeGreaterThan(0)
    expect(lemma.length).toBeGreaterThan(0)
    expect(example).toContain(form)
    expect(source).toBe('Coastal Notebook')
  }
})

test('shelf, keyboard search and the return from a book preserve catalog choices', async ({ page }) => {
  await openLibrary(page)
  const shelf = page.getByRole('button', { name: 'Книжная полка' })
  await shelf.click()
  await page.reload()
  await expect(shelf).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.shelf-book')).toHaveCount(demoCount)
  await accessibility(page, 'Книжная полка')

  const search = page.getByRole('searchbox', { name: 'Найти текст' })
  await page.keyboard.press('/')
  await expect(search).toBeFocused()
  await page.keyboard.type('sherlock')
  await expect(page.locator('.shelf-book')).toHaveCount(1)
  await page.getByRole('button', { name: /^Открыть The Adventures of Sherlock Holmes$/ }).click()
  await expect(page.getByRole('heading', { name: 'The Adventures of Sherlock Holmes' })).toBeVisible()

  const font = page.getByRole('combobox', { name: 'Размер шрифта' })
  await font.focus()
  await page.keyboard.press('End')
  await expect(font).toHaveValue('large')
  await page.getByRole('button', { name: 'Библиотека', exact: true }).click()
  await expect(search).toHaveValue('sherlock')
  await expect(shelf).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.shelf-book')).toHaveCount(1)
  await page.getByRole('button', { name: 'Список', exact: true }).click()
  await expect(page.locator('.catalog-table tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: /^Открыть The Adventures of Sherlock Holmes$/ }).click()
  await expect(font).toHaveValue('large')

  const words = page.locator('.reading-text button')
  await words.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(words.nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('all 80 vocabulary cards can be answered from the keyboard', async ({ page }) => {
  await openLibrary(page)
  await page.getByRole('button', { name: 'Пройти тест' }).click()
  await page.getByRole('button', { name: 'Начать тест' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Карточка 1 из 80', { exact: true })).toBeVisible()
  await expect(page.locator('.quiz-word h3')).toBeFocused()
  for (let index = 1; index <= 80; index++) {
    await expect(page.getByText('Карточка ' + index + ' из 80', { exact: true })).toBeVisible()
    await page.keyboard.press('ArrowLeft')
  }
  await expect(page.getByRole('dialog', { name: 'Результат теста' })).toContainText('0 слов')
  await page.getByRole('button', { name: 'Посмотреть рейтинг' }).click()
  await page.getByRole('link', { name: 'Мой словарь' }).click()
  await expect(page.getByText(/Последний тест/)).toContainText('0 слов')
})

test('library, reader, quiz and settings satisfy serious axe checks', async ({ page }) => {
  await openLibrary(page)
  await accessibility(page, 'Библиотека')
  await page.getByRole('button', { name: 'Пройти тест' }).click()
  await page.getByRole('button', { name: 'Начать тест' }).click()
  await accessibility(page, 'Тест')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Открыть Alice/ }).click()
  await expect(page.getByRole('heading', { name: 'Что выучить' })).toBeVisible()
  await accessibility(page, 'Просмотр текста')
  await page.getByLabel('Размер подборки').selectOption({ label: '20 слов' })
  await expect(page.locator('.pick-list li')).toHaveCount(20)
  await page.getByRole('button', { name: 'Экспорт в Anki' }).click()
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(20)
  await accessibility(page, 'Экспорт')
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Настройки' }).click()
  await accessibility(page, 'Настройки')
})

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  test('finds a demo excerpt and opens a reader on a narrow screen', async ({ page }) => {
    await openLibrary(page)
    await page.getByRole('searchbox', { name: 'Найти текст' }).fill('sherlock')
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await page.getByRole('button', { name: /The Adventures of Sherlock Holmes/ }).tap()
    await expect(page.getByRole('heading', { name: 'The Adventures of Sherlock Holmes' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const section = page.getByRole('group', { name: 'Раздел текста' })
    await expect(section.getByRole('button', { name: 'Читать' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.reading-text')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Экспорт в Anki' })).toBeHidden()
    await page.getByRole('button', { name: 'Скрыть подсветку' }).tap()
    await expect(page.getByRole('button', { name: 'Показать подсветку' })).toBeVisible()
    await section.getByRole('button', { name: 'Что выучить' }).tap()
    await expect(page.locator('.reading-text')).toBeHidden()
    await page.getByRole('button', { name: 'Экспорт в Anki' }).tap()
    await expect(page.getByRole('dialog', { name: 'Экспорт в Anki' })).toBeVisible()
    await page.getByRole('button', { name: 'Закрыть' }).tap()
    await section.getByRole('button', { name: 'Читать' }).tap()
    await expect(page.getByRole('button', { name: 'Показать подсветку' })).toBeVisible()
  })
})
