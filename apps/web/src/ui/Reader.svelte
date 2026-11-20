<script lang="ts">
  import Icon from './Icon.svelte'
  import Modal from './Modal.svelte'
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

<button class="text-btn breadcrumb" onclick={home}><Icon name="back" size={15} />Библиотека</button>
{#if error}<p class="error" role="alert">{error}</p>{/if}
{#if detail}
  {@const doc = detail.document}
  <div class="detail-title">
    {#if cover(doc)}<img class="detail-cover" src={cover(doc)} alt="" />{/if}
    <div>
      <span class="eyebrow"
        >{doc.isDemo ? 'Демо-отрывок' : 'Мой файл'} · {doc.kind.toUpperCase()}</span
      >
      <h1 lang="en">{doc.title}</h1>
      <p>
        {[doc.author, doc.year, doc.genre, wordCount(doc.stats.tokens)].filter(Boolean).join(' · ')}
      </p>
    </div>
  </div>
  <div class="metrics-row">
    <div><span>Покрытие слов</span><strong>{pct(doc.stats.cTok)}</strong></div>
    <div><span>Понятно целиком</span><strong>{pct(doc.stats.cSent)}</strong></div>
    <div><span>С одним новым словом</span><strong>{pct(doc.stats.cI1)}</strong></div>
    <div>
      <span>Готовность</span><span class={'badge ' + doc.stats.band}
        ><i></i>{bandNames[doc.stats.band]}</span
      >
    </div>
  </div>
  <div class="reader-layout">
    <section class="panel reading">
      <div class="section-heading">
        <h2>{doc.kind === 'srt' ? 'Реплики' : 'Текст'}</h2>
        <button class="text-btn" onclick={() => (view = view === 'text' ? 'plain' : 'text')}
          ><Icon name="eye" size={16} />{view === 'text'
            ? 'Скрыть подсветку'
            : 'Показать подсветку'}</button
        >
      </div>
      <p class="reader-hint">
        {view === 'text'
          ? 'Незнакомые слова выделены. Нажмите на слово, чтобы изменить его статус.'
          : 'Нажмите на слово, чтобы изменить его статус.'}
      </p>
      <div class="reading-text" lang="en" class:plain={view === 'plain'}>
        {#each detail.units as unit, i (page * 20 + i)}
          <p>
            {#if unit.start !== undefined}<span class="timestamp">{time(unit.start)}</span
              >{/if}{#each unit.tokens as token, i (token.start)}{unit.text.slice(
                i === 0 ? 0 : unit.tokens[i - 1].end,
                token.start,
              )}<button class:unknown={token.status === 'unknown'} onclick={() => (selected = token)}
                >{token.text}</button
              >{/each}{unit.text.slice(unit.tokens.at(-1)?.end ?? 0)}
          </p>
        {/each}
      </div>
      {#if detail.totalUnits > 20}<div class="pagination">
          <button
            class="secondary"
            disabled={!page}
            onclick={() => {
              page--
              document.querySelector('.reading')?.scrollIntoView()
            }}>Назад</button
          ><span>{page + 1} / {Math.ceil(detail.totalUnits / 20)}</span><button
            class="secondary"
            disabled={(page + 1) * 20 >= detail.totalUnits}
            onclick={() => {
              page++
              document.querySelector('.reading')?.scrollIntoView()
            }}>Дальше</button
          >
        </div>{/if}
    </section>
    <aside class="panel recommendations">
      <span class="section-icon"><Icon name="sprout" /></span>
      <h2>Что выучить</h2>
      <p>Слова, которые откроют больше предложений в этом тексте.</p>
      <label class="inline-label"
        >Размер подборки<select bind:value={limit}
          >{#each [20, 25, 30, 40] as n (n)}<option value={n}>{n} слов</option>{/each}</select
        ></label
      >
      {#if detail.picks.length}
        <div class="gain">
          <small>Понятно после изучения</small><strong>{pct(detail.picks.at(-1)!.cSentAfter)}</strong
          ><span>сейчас {pct(doc.stats.cSent)}</span>
        </div>
        <button class="primary full" onclick={() => (exporting = true)}
          ><Icon name="download" size={17} />Экспорт в Anki</button
        >
        <div class="pick-label"><span>Лемма</span><span>Понятно после</span></div>
        <ol class="pick-list">
          {#each detail.picks as pick (pick.lemma)}<li>
              <details>
                <summary
                  ><strong lang="en">{pick.lemma}</strong><span>{pct(pick.cSentAfter)}</span></summary
                >
                <p lang="en">{pick.example}</p>
                <small>Новых понятных предложений на этом шаге: {pick.unlocked}</small>
              </details>
            </li>{/each}
        </ol>
      {:else}<p class="inline-note">Все слова этого текста уже знакомы или исключены.</p>{/if}
    </aside>
  </div>
  <div class="reader-foot">
    <span>Фразовые глаголы и идиомы оцениваются по отдельным словам.</span>{#if doc.source}<a
        href={doc.source}
        target="_blank"
        rel="noreferrer">Источник текста</a
      >{/if}<button class="text-btn danger-text" onclick={() => remove(id)}>Удалить текст</button>
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
        ><button class="secondary" disabled={busy} onclick={() => mark('ignored')}>Исключить</button>
      </div></Modal
    >{/if}
  {#if exporting}<Modal title="Экспорт в Anki" wide onclose={() => (exporting = false)}
      ><p class="intro">
        {wordCount(detail.picks.length)} с примерами из «{doc.title}». При импорте сопоставьте четыре
        поля с вашей заметкой Anki.
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
        <button class="primary" onclick={save}><Icon name="download" size={17} />Скачать CSV</button>
      </div></Modal
    >{/if}
{:else if !error}<p class="loading" role="status">Открываем текст…</p>{/if}
