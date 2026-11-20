<script lang="ts">
  import Icon from './Icon.svelte'
  import Modal from './Modal.svelte'
  import { onMount } from 'svelte'
  import './reader.css'
  import {
    getDetail,
    exportWords,
    setWord,
    type Detail,
    type ReadingUnit,
    type WordStatus,
    type LibraryState,
  } from '../lib/client'
  import { bandNames, cover, download, pct, statusNames, wordCount } from './format'
  let {
    id,
    version,
    home,
    changed,
    notify,
    remove,
  }: {
    id: string
    version: number
    home: () => void
    changed: (s: LibraryState) => void
    notify: (s: string) => void
    remove: (id: string) => void
  } = $props()
  let detail = $state<Detail | null>(null),
    limit = $state(25),
    page = $state(0),
    view = $state('text'),
    exporting = $state(false),
    selected = $state<ReadingUnit['tokens'][number] | null>(null),
    error = $state(''),
    busy = $state(false),
    request = 0
  const sizeLabels = { compact: 'Мелкий', regular: 'Средний', large: 'Крупный' } as const
  type FontSize = keyof typeof sizeLabels
  let fontSize = $state<FontSize>('regular')
  let activePanel = $state<'reading' | 'words'>('reading')
  let allPicks = $state(false)
  let focusedWord = $state<string | null>(null)
  let paper = $state<HTMLElement>()

  // Keep opening quotes, punctuation and contractions with their words at line breaks.
  function wordGroups(unit: ReadingUnit) {
    let index = 0
    return Array.from(unit.text.matchAll(/\S+\s*|\s+/gu), (match) => {
      const start = match.index
      const content = match[0].trimEnd()
      const end = start + content.length
      const first = index
      while (index < unit.tokens.length && unit.tokens[index].end <= end) index++
      return {
        start,
        end,
        space: match[0].slice(content.length),
        tokens: unit.tokens.slice(first, index),
      }
    })
  }

  onMount(() => {
    try {
      const saved = localStorage.getItem('coverage-finder:reading-size')
      if (saved === 'compact' || saved === 'regular' || saved === 'large') fontSize = saved
    } catch {
      /* The reader also works with storage disabled. */
    }
  })
  function changeSize(size: FontSize) {
    fontSize = size
    try {
      localStorage.setItem('coverage-finder:reading-size', size)
    } catch {
      /* In-session setting. */
    }
  }
  function navigateWords(event: KeyboardEvent) {
    if (!paper || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const words = Array.from(paper.querySelectorAll<HTMLButtonElement>('.reading-text button'))
    const here = words.indexOf(event.currentTarget as HTMLButtonElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? words.length - 1
          : here + (event.key === 'ArrowLeft' ? -1 : 1)
    event.preventDefault()
    words[next]?.focus()
  }
  function changePage(next: number) {
    page = next
    focusedWord = null
    paper?.scrollIntoView({ block: 'start' })
  }
  $effect(() => {
    const args = [id, limit, page, version] as const
    void refresh(...args)
  })
  async function refresh(docId: string, k: number, pageNo: number, _version: number) {
    void _version
    const ticket = ++request
    try {
      const data = await getDetail(docId, k, pageNo * 20, 20)
      if (ticket === request) {
        detail = data
        error = ''
      }
    } catch (e) {
      if (ticket === request) error = (e as Error).message
    }
  }
  async function mark(status: WordStatus) {
    if (!selected || busy) return
    busy = true
    try {
      const word = selected.lemma
      changed(await setWord(word, status))
      selected = null
      notify(word + ' · ' + statusNames[status])
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
    }
  }
  async function save() {
    if (!detail) return
    try {
      const csv = await exportWords(id, limit)
      download(
        csv,
        detail.document.title.replace(/[<>:"/\\|?*]/g, '') + ' — Anki.csv',
        'text/csv;charset=utf-8',
      )
      exporting = false
      notify('CSV для Anki скачан')
    } catch (e) {
      error = (e as Error).message
    }
  }
  function time(seconds: number) {
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds) % 60).padStart(2, '0')
  }
</script>

<div class="reader-page">
  <button class="text-btn reader-back" onclick={home}><Icon name="back" size={16} />Библиотека</button
  >
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if detail}
    {@const doc = detail.document}
    {@const unitKind = doc.kind === 'srt' ? 'Реплики' : 'Текст'}
    <header class="reader-title">
      {#if cover(doc)}
        <img class="reader-cover" src={cover(doc)} alt="" />
      {:else}
        <span class="reader-cover reader-cover-empty"
          ><Icon name={doc.kind === 'srt' ? 'test' : 'doc'} size={30} /></span
        >
      {/if}
      <div class="reader-title-copy">
        <div class="reader-classification">
          <span>{doc.isDemo ? 'Демо-отрывок' : 'Мой файл'} · {doc.kind.toUpperCase()}</span>
          <span class={'badge ' + doc.stats.band}><i></i>{bandNames[doc.stats.band]}</span>
        </div>
        <h1 lang="en">{doc.title}</h1>
        <p>
          {[doc.author, doc.year, doc.genre, wordCount(doc.stats.tokens)].filter(Boolean).join(' · ')}
        </p>
      </div>
    </header>
    <div class="metrics-row reader-metrics" aria-label="Показатели текста">
      {#each [{ label: 'Покрытие слов', value: doc.stats.cTok, icon: 'book' }, { label: 'Понятно целиком', value: doc.stats.cSent, icon: 'checkCircle' }, { label: 'С одним новым словом', value: doc.stats.cI1, icon: 'sprout' }] as metric (metric.label)}
        <div>
          <span><Icon name={metric.icon} size={15} />{metric.label}</span><strong
            >{pct(metric.value)}</strong
          >
        </div>
      {/each}
    </div>

    <div class="reader-mobile-switch" role="group" aria-label="Раздел текста">
      <button aria-pressed={activePanel === 'reading'} onclick={() => (activePanel = 'reading')}
        ><Icon name="book" size={17} />Читать</button
      >
      <button aria-pressed={activePanel === 'words'} onclick={() => (activePanel = 'words')}
        ><Icon name="sprout" size={17} />Что выучить</button
      >
    </div>

    <div class="edition-layout" class:show-words={activePanel === 'words'}>
      <section class="reader-paper" bind:this={paper} aria-labelledby="reading-heading">
        <header class="reader-toolbar">
          <h2 id="reading-heading">{unitKind}</h2>
          <div class="reader-tools">
            <label class="reader-size">
              <span aria-hidden="true">Aa</span>
              <select
                aria-label="Размер шрифта"
                value={fontSize}
                onchange={(e) => changeSize(e.currentTarget.value as FontSize)}
              >
                {#each Object.entries(sizeLabels) as [size, label] (size)}<option value={size}
                    >{label}</option
                  >{/each}
              </select>
            </label>
            <button
              class="reader-highlight"
              aria-pressed={view === 'text'}
              onclick={() => (view = view === 'text' ? 'plain' : 'text')}
              ><Icon name="eye" size={16} />{view === 'text'
                ? 'Скрыть подсветку'
                : 'Показать подсветку'}</button
            >
          </div>
        </header>
        <p class="reader-instruction">Нажмите на слово, чтобы изменить его статус.</p>
        <span class="reader-sr-only" id="reading-keyboard"
          >В тексте переходите между словами стрелками влево и вправо. Нажмите Enter, чтобы открыть
          слово.</span
        >
        <div class="reading-text" lang="en" class:plain={view === 'plain'} data-size={fontSize}>
          {#each detail.units as unit, unitIndex (page * 20 + unitIndex)}
            <p class:subtitle-line={unit.start !== undefined}>
              {#if unit.start !== undefined}<span class="timestamp">{time(unit.start)}</span
                >{/if}{#each wordGroups(unit) as group (group.start)}<span class="reader-word-group"
                  >{#each group.tokens as token, i (token.start)}{@const key =
                      unitIndex + '/' + token.start}{@const firstWord =
                      unitIndex === 0 && token.start === unit.tokens[0].start}{unit.text.slice(
                      i === 0 ? group.start : group.tokens[i - 1].end,
                      token.start,
                    )}<button
                      class:unknown={token.status === 'unknown'}
                      tabindex={(focusedWord === null ? firstWord : focusedWord === key) ? 0 : -1}
                      aria-describedby={firstWord ? 'reading-keyboard' : undefined}
                      onfocus={() => (focusedWord = key)}
                      onkeydown={navigateWords}
                      onclick={() => (selected = token)}>{token.text}</button
                    >{/each}{unit.text.slice(
                    group.tokens.at(-1)?.end ?? group.start,
                    group.end,
                  )}</span
                >{group.space}{/each}
            </p>
          {/each}
        </div>
        {#if detail.totalUnits > 20}
          <div class="pagination reader-pagination">
            <button class="secondary" disabled={!page} onclick={() => changePage(page - 1)}
              >Назад</button
            >
            <span>Страница {page + 1} из {Math.ceil(detail.totalUnits / 20)}</span>
            <button
              class="secondary"
              disabled={(page + 1) * 20 >= detail.totalUnits}
              onclick={() => changePage(page + 1)}>Дальше</button
            >
          </div>
        {/if}
      </section>

      <aside class="study-sheet" aria-labelledby="study-heading">
        <header class="study-heading">
          <span><Icon name="sprout" size={21} /></span>
          <h2 id="study-heading">Что выучить</h2>
        </header>
        <p class="study-intro">Слова, которые помогут понять больше предложений в тексте.</p>
        <label class="study-size"
          >Размер подборки<select bind:value={limit}>
            {#each [20, 25, 30, 40] as n (n)}<option value={n}>{n} слов</option>{/each}
          </select></label
        >
        {#if detail.picks.length}
          {@const after = detail.picks.at(-1)!.cSentAfter}
          <div class="study-gain">
            <span>Понятно после изучения</span>
            <div><strong>{pct(after)}</strong><small>сейчас {pct(doc.stats.cSent)}</small></div>
            <div class="study-track" aria-hidden="true">
              <i style:width={100 * after + '%'}></i><b style:width={100 * doc.stats.cSent + '%'}></b>
            </div>
          </div>
          <button class="primary full" onclick={() => (exporting = true)}
            ><Icon name="download" size={17} />Экспорт в Anki</button
          >
          <div class="study-columns"><span>Слово</span><span>Понятно после</span></div>
          <ol class="pick-list" class:abbreviated={!allPicks}>
            {#each detail.picks as pick (pick.lemma)}
              <li>
                <details>
                  <summary
                    ><strong lang="en">{pick.lemma}</strong><span
                      >{pct(pick.cSentAfter)}<Icon name="down" size={13} /></span
                    ></summary
                  >
                  <p lang="en">{pick.example}</p>
                  <small>Новых понятных предложений на этом шаге: {pick.unlocked}</small>
                </details>
              </li>
            {/each}
          </ol>
          {#if detail.picks.length > 5}
            <button
              class="study-more"
              aria-expanded={allPicks}
              onclick={() => (allPicks = !allPicks)}
            >
              {allPicks ? 'Свернуть список' : 'Показать все ' + wordCount(detail.picks.length)}<Icon
                name="down"
                size={14}
              />
            </button>
          {/if}
        {:else}
          <p class="inline-note">Все слова этого текста уже знакомы или исключены.</p>
        {/if}
      </aside>
    </div>
    <div class="reader-foot">
      <span>Фразовые глаголы и идиомы оцениваются по отдельным словам.</span>
      {#if doc.source}<a href={doc.source} target="_blank" rel="noreferrer">Источник текста</a>{/if}
      <button class="text-btn danger-text" onclick={() => remove(id)}>Удалить текст</button>
    </div>
    {#if selected}<Modal title={selected.lemma} onclose={() => (selected = null)}
        ><p class="intro">
          В тексте <strong lang="en">{selected.text}</strong>. Текущий статус — {statusNames[
            selected.status
          ].toLowerCase()}.{selected.proper ? ' Это слово распознано как имя.' : ''}
        </p>
        <div class="word-actions">
          <button class="primary" disabled={busy} onclick={() => mark('known')}
            ><Icon name="check" size={16} />Знаю</button
          ><button class="secondary" disabled={busy} onclick={() => mark('unknown')}>Не знаю</button
          ><button class="secondary" disabled={busy} onclick={() => mark('ignored')}>Исключить</button
          >
        </div></Modal
      >{/if}
    {#if exporting}<Modal title="Экспорт в Anki" wide onclose={() => (exporting = false)}
        ><p class="intro">
          {wordCount(detail.picks.length)} с примерами из «{doc.title}». При импорте сопоставьте
          четыре поля с вашей заметкой Anki.
        </p>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users scroll the export preview.) -->
        <div
          tabindex="0"
          role="region"
          aria-label="Предпросмотр CSV"
          class="preview-table export-table"
        >
          <table>
            <thead><tr><th>Слово</th><th>Лемма</th><th>Пример</th><th>Источник</th></tr></thead><tbody
              >{#each detail.picks as pick (pick.lemma)}<tr
                  ><td>{pick.word}</td><td>{pick.lemma}</td><td>{pick.example}</td><td>{doc.title}</td
                  ></tr
                >{/each}</tbody
            >
          </table>
        </div>
        <div class="modal-actions">
          <button class="primary" onclick={save}><Icon name="download" size={17} />Скачать CSV</button
          >
        </div></Modal
      >{/if}
  {:else if !error}<p class="loading" role="status">Открываем текст…</p>{/if}
</div>
