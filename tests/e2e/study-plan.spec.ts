import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

async function checkAccessibility(page: Page) {
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(audit.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => ({ rule: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([])
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

test('phone users can select texts across searches and open their plan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#plan')
  const search = page.getByRole('searchbox', { name: 'Поиск текстов для плана' })
  await search.fill('alice')
  await page.getByRole('checkbox', { name: /Alice/ }).check()
  await search.fill('sherlock')
  await page.getByRole('checkbox', { name: /Sherlock/ }).check()
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Составить план' }).click()
  await expect(page.getByRole('heading', { name: /Если выучить/ })).toBeVisible()
  await expect(page.locator('.plan-impact li')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
