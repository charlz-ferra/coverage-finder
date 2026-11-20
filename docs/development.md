# Разработка и публикация Coverage Finder

Для чтения сборка не нужна: [скачайте готовый ZIP](../downloads/Coverage-Finder.zip?raw=true). Ниже — инструкции для тех, кто меняет приложение.

## Сборка из исходников

Требуются Node.js 22.13+ и pnpm 10. Версия менеджера пакетов указана в `package.json`. Языковые данные включены в репозиторий.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm build` создаёт статическое приложение в `dist/`. `pnpm preview` запускает предварительный просмотр.

| Каталог | Содержимое |
| --- | --- |
| `apps/web` | Интерфейс Svelte, Web Worker с Comlink, хранение в IndexedDB через Dexie |
| `packages/core` | Разбор EPUB, TXT, SRT и словарей, метрики, выбор слов, экспорт CSV |
| `packages/lang-en` | Английская морфология, частотные диапазоны, тест словаря, сборщик данных |
| `data` | Снимки языковых данных, литературные тексты и лицензии |
| `tests/e2e` | Браузерные сценарии Playwright и проверки доступности |

## Проверки

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
pnpm size
pnpm exec playwright install chromium
pnpm test:e2e
pnpm --filter @coverage/core bench
```

На локальной машине с Node 22.16 разбор и подсчёт метрик для текста в 100 тысяч токенов заняли в среднем 82 мс, подбор 40 слов — 3 мс. Замеры чистого ядра исключают запись в IndexedDB и отрисовку. Проверка размера отдельно измеряет основной JavaScript и модуль анализа вместе с данными.

## Обновить загрузку для читателей

Из корня проекта после изменений в приложении:

```sh
python scripts/package-offline.py
python scripts/package-offline.py --check
python tests/offline/test_download.py
```

В macOS/Linux команда Python может называться `python3`. Скрипт собирает `downloads/Coverage-Finder.zip` из готовой статики, лаунчера, инструкции и лицензий. Распакуйте архив в отдельную папку и откройте библиотеку, прежде чем включить его в коммит. Не добавляйте `dist/`, `node_modules/`, свои книги или резервные копии в Git. Если оформляете выпуск GitHub Releases, тот же ZIP можно прикрепить в **Assets**: стандартные **Source code** — не готовая библиотека.

## Веб-версия через GitHub Pages

Для репозитория, который можно публиковать в интернете, владелец выбирает **Settings → Pages → Build and deployment → Source: GitHub Actions**. После успешного CI для push в `main` workflow **Publish GitHub Pages** публикует `dist/`. Скопируйте фактический адрес из успешного deployment, проверьте его без входа в GitHub и только потом добавьте в **About → Website** и README. Не включайте Pages для закрытого проекта без решения владельца: сайт может стать общедоступным.

[Архитектурные решения](adr) · [Источники данных](../data/LICENSE-DATA.md) · [Вернуться к инструкции для читателя](../README.md)
