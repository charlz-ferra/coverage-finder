<script lang="ts">
  import { onMount, tick } from 'svelte'
  import {
    loadLibrary,
    exportBackup,
    restoreBackup,
    eraseData,
    removeDocument,
    getLastTest,
    type LibraryState,
  } from './lib/client'
  import Icon from './ui/Icon.svelte'
  import Library from './ui/Library.svelte'
  import Reader from './ui/Reader.svelte'
  import Dictionary from './ui/Dictionary.svelte'
  import VocabImport from './ui/VocabImport.svelte'
  import Quiz from './ui/Quiz.svelte'
  import Modal from './ui/Modal.svelte'
  import Upload from './ui/Upload.svelte'
  import { download, readTextFile, wordCount, pct } from './ui/format'
  import './style.css'
  import './workspace.css'
  import { createCatalogPreferences } from './ui/catalog'
  const catalog = $state(createCatalogPreferences())
  let recentId = $state(''),
    libraryScroll = 0
  let library = $state<LibraryState | null>(null),
    route = $state('library'),
    modal = $state(''),
    error = $state(''),
    toast = $state(''),
    fatal = $state(''),
    busy = $state(false)
  let initialFiles = $state<File[]>([]),
    dragging = $state(false),
    dragDepth = 0,
    target = $state(''),
    backupFile = $state<File | null>(null),
    restoreInput = $state<HTMLInputElement>(),
    messageTimer: ReturnType<typeof setTimeout>
  let quizResult = $state(''),
    refreshTicket = 0
  const nav = [
    { id: 'library', title: 'Библиотека', icon: 'library' },
    { id: 'dictionary', title: 'Мой словарь', icon: 'words' },
    { id: 'settings', title: 'Настройки', icon: 'gear' },
  ]
  function sync() {
    const hash = location.hash.slice(1)
    const previous = route
    if (previous === 'library') libraryScroll = window.scrollY
    route = hash.startsWith('text/') || nav.some((n) => n.id === hash) ? hash : 'library'
    if (route.startsWith('text/')) recentId = route.slice(5)
    modal = ''
    error = ''
    const destination = route === 'library' && previous.startsWith('text/') ? libraryScroll : 0
    void tick().then(() => window.scrollTo(0, destination))
  }
  function go(id: string) {
    const hash = '#' + id
    if (route === id || location.hash === hash) {
      // The initial bare URL already shows the library. Avoid a delayed hashchange closing the next dialog.
      if (location.hash !== hash) history.replaceState(history.state, '', hash)
      sync()
    } else {
      location.hash = id
    }
  }
  function notify(message: string) {
    toast = message
    clearTimeout(messageTimer)
    messageTimer = setTimeout(() => (toast = ''), 4800)
  }
  function changed(value: LibraryState) {
    library = value
  }
  function open(which: string) {
    error = ''
    modal = which
  }
  function upload() {
    initialFiles = []
    open('upload')
  }
  function close() {
    if (busy) return
    modal = ''
    error = ''
  }
  async function refresh() {
    const ticket = ++refreshTicket
    try {
      const s = await loadLibrary()
      if (ticket === refreshTicket) {
        library = s
        fatal = ''
      }
    } catch (e) {
      fatal = (e as Error).message
    }
  }
  onMount(() => {
    sync()
    void refresh()
    window.addEventListener('hashchange', sync)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('focus', refresh)
      clearTimeout(messageTimer)
    }
  })
  async function backup() {
    try {
      download(
        await exportBackup(),
        'coverage-finder-' + new Date().toISOString().slice(0, 10) + '.json',
        'application/json',
      )
      notify('Резервная копия скачана')
    } catch (e) {
      notify((e as Error).message)
    }
  }
  async function confirm() {
    busy = true
    error = ''
    try {
      if (modal === 'erase') {
        changed(await eraseData())
        notify('Данные библиотеки удалены')
      } else if (modal === 'restore' && backupFile) {
        changed(await restoreBackup(await readTextFile(backupFile, Number.POSITIVE_INFINITY)))
        notify('Библиотека восстановлена')
      } else if (modal === 'remove') {
        changed(await removeDocument(target))
        go('library')
        notify('Текст удалён')
      }
      modal = ''
      backupFile = null
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
      if (restoreInput) restoreInput.value = ''
    }
  }
  async function finishQuiz(value: LibraryState) {
    changed(value)
    const last = await getLastTest()
    quizResult = last
      ? 'Оценка — ' +
        wordCount(last.size) +
        '. Доля ответов «знаю» на вымышленные слова — ' +
        pct(last.falseAlarmRate) +
        '.'
      : ''
    open('quiz-result')
  }
  function dragEnter(e: DragEvent) {
    if (modal || !e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    dragDepth++
    dragging = true
  }
  function drop(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    dragDepth = 0
    dragging = false
    if (modal) return
    initialFiles = Array.from(e.dataTransfer.files)
    if (initialFiles.length) open('upload')
  }
  $effect(() => {
    if (!library) return
    const label = route.startsWith('text/')
      ? library.documents.find((d) => d.id === route.slice(5))?.title
      : nav.find((n) => n.id === route)?.title
    document.title = (label ?? 'Библиотека') + ' · Coverage Finder'
  })
</script>

<svelte:window
  ondragenter={dragEnter}
  ondragleave={() => {
    dragDepth = Math.max(0, dragDepth - 1)
    if (!dragDepth) dragging = false
  }}
  ondragover={(e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
  }}
  ondrop={drop}
/>
<a
  href="#content"
  class="skip"
  onclick={(e) => {
    e.preventDefault()
    document.getElementById('content')?.focus()
  }}>К содержимому</a
>
<div class="workspace">
  <aside class="side-rail" aria-label="Рабочая область">
    <a class="wordmark" href="#library" aria-label="Coverage Finder — библиотека">
      <span class="brand-symbol"><Icon name="book" size={25} /></span><span>Coverage Finder</span>
    </a>
    <nav class="main-nav" aria-label="Основная навигация">
      {#each nav as item (item.id)}
        <a
          href={'#' + item.id}
          aria-current={route === item.id || (route.startsWith('text/') && item.id === 'library')
            ? 'page'
            : undefined}
        >
          <Icon name={item.icon} size={19} /><span>{item.title}</span>
        </a>
      {/each}
    </nav>
    <div class="rail-tools">
      <h2>Инструменты</h2>
      <button onclick={() => open('vocab')}><Icon name="upload" size={18} />Импорт словаря</button>
      <button onclick={() => open('quiz')}><Icon name="test" size={18} />Тест словаря</button>
    </div>
    <div class="rail-bottom">
      <button class="method-link" onclick={() => open('method')}
        ><Icon name="info" size={18} />Методика расчёта</button
      >
      <div class="storage-status">
        <span class="shield-tile"><Icon name="shield" size={20} /></span><span
          ><strong>Локальный режим</strong><small>Данные на устройстве</small></span
        >
      </div>
    </div>
    <span class="mobile-local"><Icon name="shield" size={16} />Локальный режим</span>
  </aside>
  <main id="content" tabindex="-1" class="workspace-main">
    {#if fatal}<div class="empty">
        <h1>Не удалось открыть библиотеку</h1>
        <p>{fatal}</p>
        <button class="primary" onclick={refresh}>Повторить</button>
      </div>
    {:else if !library}<p class="loading" role="status">Открываем локальную библиотеку…</p>
    {:else if route.startsWith('text/')}
      {#key route}<Reader
          id={route.slice(5)}
          version={library.vocabVersion}
          home={() => go('library')}
          {changed}
          {notify}
          remove={(id) => {
            target = id
            open('remove')
          }}
        />{/key}
    {:else if route === 'dictionary'}<Dictionary
        state={library}
        upload={() => open('vocab')}
        quiz={() => open('quiz')}
        {changed}
        {notify}
      />
    {:else if route === 'settings'}
      <div class="page-heading">
        <div>
          <h1>Настройки</h1>
          <p>Язык анализа, резервные копии и данные этого браузера.</p>
        </div>
      </div>
      <div class="settings-grid">
        <section class="panel">
          <div class="section-heading">
            <h2>Хранение данных</h2>
            <Icon name="shield" />
          </div>
          <p>
            Тексты, словарь и история хранятся на этом устройстве. Скачайте JSON-копию, чтобы
            перенести библиотеку или восстановить её после очистки браузера.
          </p>
          <div class="settings-action">
            <div>
              <h3>Резервная копия</h3>
              <small>Весь словарь и разобранные тексты</small>
            </div>
            <button class="secondary" onclick={backup}
              ><Icon name="download" size={16} />Скачать JSON</button
            >
          </div>
          <div class="settings-action">
            <div>
              <h3>Восстановление</h3>
              <small>Заменить данные содержимым копии</small>
            </div>
            <button class="secondary" onclick={() => restoreInput?.click()}
              ><Icon name="upload" size={16} />Выбрать JSON</button
            >
          </div>
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Резервная копия JSON"
            hidden
            bind:this={restoreInput}
            onchange={(e) => {
              backupFile = e.currentTarget.files?.[0] ?? null
              if (backupFile) open('restore')
              e.currentTarget.value = ''
            }}
          />
          <div class="settings-action">
            <div>
              <h3>Удаление данных</h3>
              <small>Очистить библиотеку и словарь</small>
            </div>
            <button class="danger-btn" onclick={() => open('erase')}>Удалить всё</button>
          </div>
        </section>
        <section class="panel">
          <h2>Об анализе</h2>
          <div class="settings-action"><span>Язык текстов</span><strong>Английский</strong></div>
          <p>
            Имена и исключённые слова считаются знакомыми. Их статус можно изменить в тексте или
            словаре.
          </p>
          <button class="text-btn" onclick={() => open('method')}
            ><Icon name="info" size={16} />Методика расчёта</button
          >
          <div class="settings-links">
            <a
              href={import.meta.env.BASE_URL + 'data/LICENSE-DATA.md'}
              target="_blank"
              rel="noreferrer">Источники и лицензии данных</a
            >
          </div>
        </section>
      </div>
    {:else}<Library
        state={library}
        {catalog}
        updateCatalog={(patch) => Object.assign(catalog, patch)}
        {recentId}
        dictionary={() => go('dictionary')}
        {upload}
        open={(id) => go('text/' + id)}
        vocab={() => open('vocab')}
        quiz={() => open('quiz')}
        details={() => open('method')}
      />{/if}
  </main>
</div>
{#if modal === 'vocab'}<Modal title="Загрузить словарь" onclose={close}
    ><VocabImport
      finish={(v) => {
        changed(v)
        open('imported')
      }}
    /></Modal
  >
{:else if modal === 'imported'}<Modal title="Словарь обновлён" onclose={close}
    ><p class="intro">
      Теперь в словаре {wordCount(library?.knownCount ?? 0)}. Рейтинг текстов пересчитан. Скачайте
      резервную копию, чтобы сохранить результат.
    </p>
    <div class="modal-actions">
      <button class="secondary" onclick={backup}>Скачать JSON</button><button
        class="primary"
        onclick={() => {
          close()
          go('library')
        }}>В библиотеку</button
      >
    </div></Modal
  >
{:else if modal === 'quiz'}<Modal title="Оценка словаря" onclose={close}
    ><Quiz finish={finishQuiz} /></Modal
  >
{:else if modal === 'quiz-result'}<Modal title="Результат теста" onclose={close}
    ><p class="intro">
      {quizResult} Рейтинг пересчитан. Уточняйте свою оценку, отмечая слова в тексте.
    </p>
    <div class="modal-actions">
      <button
        class="primary"
        onclick={() => {
          close()
          go('library')
        }}>Посмотреть рейтинг</button
      >
    </div></Modal
  >
{:else if modal === 'upload'}<Modal title="Добавить текст" onclose={close}
    ><Upload
      initial={initialFiles}
      {changed}
      done={() => {
        close()
        go('library')
      }}
    /></Modal
  >
{:else if modal === 'method'}<Modal title="Как считается рейтинг" onclose={close}
    ><div class="method">
      <p>
        Тексты отсортированы по доле предложений, в которых знакомо каждое слово. Для субтитров
        единица анализа — одна реплика.
      </p>
      <h3>Покрытие слов</h3>
      <p>
        Доля знакомых слов среди всех словоупотреблений, включая повторы. «Можно читать» начинается с
        98%, «с усилием» — с 95%, ниже — «пока рано».
      </p>
      <h3>Понятно целиком</h3>
      <p>
        Доля предложений без незнакомых лемм. Формы <i>go</i> и <i>went</i> считаются одним словом.
      </p>
      <h3>+1 слово</h3>
      <p>Доля предложений с одной незнакомой леммой, даже если она повторяется несколько раз.</p>
      <h3>Что выучить</h3>
      <p>
        Каждый шаг выбирает слово, которое откроет больше предложений с учётом предыдущих шагов. При
        близком результате помогает частота слова.
      </p>
      <p class="inline-note">
        Покрытие показывает знакомую лексику. Идиомы, фразовые глаголы и сложность грамматики влияют
        на фактическое понимание.
      </p>
    </div></Modal
  >
{:else if ['remove', 'erase', 'restore'].includes(modal)}<Modal
    title={modal === 'restore'
      ? 'Восстановить библиотеку?'
      : modal === 'erase'
        ? 'Удалить все данные?'
        : 'Удалить текст?'}
    onclose={close}
    ><p class="intro">
      {modal === 'restore'
        ? 'Текущие тексты, словарь и история будут заменены данными из файла «' +
          backupFile?.name +
          '».'
        : modal === 'erase'
          ? 'Все тексты, словарь и история этого браузера будут удалены. Для восстановления понадобится резервная копия.'
          : 'Текст будет удалён из библиотеки. Ваши отметки слов сохранятся.'}
    </p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="modal-actions">
      <button class="secondary" disabled={busy} onclick={close}>Отмена</button><button
        class={modal === 'restore' ? 'primary' : 'danger-btn'}
        disabled={busy}
        onclick={confirm}
        >{busy ? 'Обрабатываем…' : modal === 'restore' ? 'Восстановить' : 'Удалить'}</button
      >
    </div></Modal
  >{/if}
{#if dragging}<div class="drag-overlay">
    <Icon name="upload" size={42} />Отпустите книги или субтитры здесь
  </div>{/if}
<div class="toast-zone" role="status" aria-live="polite">
  {#if toast}<div class="toast">
      <Icon name="checkCircle" size={18} />{toast}<button
        aria-label="Скрыть уведомление"
        onclick={() => (toast = '')}><Icon name="close" size={14} /></button
      >
    </div>{/if}
</div>
