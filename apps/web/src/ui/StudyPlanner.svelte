<script lang="ts">
  import { onMount, tick } from 'svelte'
  import {
    getSavedStudySelection,
    getStudyPlan,
    setWord,
    type LibraryState,
    type StudyPlan,
  } from '../lib/client'
  import Icon from './Icon.svelte'
  import { bandNames, cover, download, num, pct, plural, wordCount } from './format'
  import './study-planner.css'

  let {
    state: library,
    upload,
    notify,
    changed,
  }: {
    state: LibraryState
    upload: () => void
    notify: (message: string) => void
    changed: (state: LibraryState) => void
  } = $props()

  type Request = { ids: string[]; limit: number; save: boolean }
  let request = $state.raw<Request | null>(null)
  let result = $state.raw<StudyPlan | null>(null)
  let selected = $state<string[]>([]),
    limit = $state(20),
    query = $state('')
  let editing = $state(true),
    starting = $state(true),
    busy = $state(false),
    savingWord = $state(false),
    error = $state('')
  let resultHeading = $state<HTMLHeadingElement>()
  let lastRequest: Request | null = null
  const documentCount = (n: number) => num(n) + ' ' + plural(n, ['текст', 'текста', 'текстов'])
  const unitCount = (n: number) => num(n) + ' ' + plural(n, ['фрагмент', 'фрагмента', 'фрагментов'])
  const availableIds = $derived(
    library.documents
      .map((doc) => doc.id)
      .sort()
      .join('\n'),
  )
  const sizes = $derived([...new Set([10, 20, 25, 30, 40, limit])].sort((a, b) => a - b))
  const chosen = $derived(selected.filter((id) => library.documents.some((doc) => doc.id === id)))
  const candidates = $derived.by(() => {
    const text = query.trim().toLocaleLowerCase('en')
    return library.documents
      .filter((doc) => (doc.title + ' ' + doc.author).toLocaleLowerCase('en').includes(text))
      .sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || a.title.localeCompare(b.title, 'en'))
  })

  onMount(() => {
    let live = true
    getSavedStudySelection()
      .then((saved) => {
        if (live && saved) {
          selected = saved.ids
          limit = saved.limit
          editing = false
          request = { ...saved, save: false }
        }
      })
      .catch((e) => {
        if (live) error = (e as Error).message
      })
      .finally(() => {
        if (live) starting = false
      })
    return () => {
      live = false
    }
  })

  // Recalculate an open plan after a vocabulary change, even if its selection is unchanged.
  $effect(() => {
    const job = request
    const ids = new Set(availableIds.split('\n'))
    void library.vocabVersion
    if (!job) return
    if (!job.ids.every((id) => ids.has(id))) {
      selected = job.ids.filter((id) => ids.has(id))
      request = null
      result = null
      editing = true
      busy = false
      error = 'Состав библиотеки изменился. Проверьте выбор текстов.'
      return
    }
    let live = true
    const save = job.save && lastRequest !== job
    lastRequest = job
    busy = true
    error = ''
    getStudyPlan([...job.ids], job.limit, save)
      .then(async (data) => {
        if (!live) return
        result = data
        busy = false
        if (save) {
          await tick()
          resultHeading?.focus({ preventScroll: true })
        }
      })
      .catch((e) => {
        if (live) {
          result = null
          error = (e as Error).message
          busy = false
        }
      })
    return () => {
      live = false
    }
  })
  function toggle(id: string) {
    selected = chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id]
  }
  function calculate() {
    if (chosen.length < 2) return
    editing = false
    result = null
    request = { ids: [...chosen], limit, save: true }
    window.scrollTo(0, 0)
  }
  function edit() {
    if (request) {
      selected = [...request.ids]
      limit = request.limit
    }
    query = ''
    error = ''
    editing = true
  }
  function exportCards() {
    if (!result?.picks.length) return
    download(result.csv, 'coverage-finder-study-plan.csv', 'text/csv;charset=utf-8')
    notify('Подборка для Anki скачана')
  }
  async function mark(lemma: string, status: 'known' | 'ignored') {
    if (busy || savingWord) return
    savingWord = true
    try {
      changed(await setWord(lemma, status))
      notify(
        lemma +
          (status === 'known'
            ? ' добавлено в знакомые слова'
            : ' исключено из расчёта во всей библиотеке'),
      )
    } catch (e) {
      error = (e as Error).message
    } finally {
      savingWord = false
    }
  }
</script>

<div class="page-heading">
  <div>
    <h1>План слов</h1>
    <p>Одна подборка для нескольких книг или серий.</p>
  </div>
  {#if !editing && !starting}<button class="secondary plan-edit" onclick={edit}
      ><Icon name="settings" size={17} />Изменить подборку</button
    >{/if}
</div>
{#if error}<p class="error" role="alert">{error}</p>{/if}
{#if starting}<p class="loading" role="status">Открываем план…</p>
{:else if editing}
  <section class="plan-setup" aria-labelledby="plan-choose">
    <div class="plan-choices">
      <div class="plan-section-head">
        <h2 id="plan-choose">Выберите тексты</h2>
        <span>{documentCount(library.documents.length)}</span>
      </div>
      <p>
        Включите в план хотя бы два текста. Подбор учитывает каждое предложение в книгах и каждую
        реплику в субтитрах.
      </p>
      {#if library.documents.length}
        <label class="plan-search"
          ><Icon name="search" size={17} /><input
            type="search"
            aria-label="Поиск текстов для плана"
            placeholder="Название или автор"
            bind:value={query}
          /></label
        >
        <div class="plan-options" role="group" aria-label="Тексты для подбора">
          {#each candidates as doc (doc.id)}
            <label class:checked={chosen.includes(doc.id)}>
              <input
                type="checkbox"
                checked={chosen.includes(doc.id)}
                onchange={() => toggle(doc.id)}
                aria-label={doc.title}
              />
              {#if cover(doc)}<img src={cover(doc)} alt="" />{:else}<span class="plan-file"
                  ><Icon name={doc.kind === 'srt' ? 'test' : 'doc'} size={19} /></span
                >{/if}
              <span class="plan-doc-name"
                ><strong lang="en">{doc.title}</strong><small
                  >{doc.author || 'Мой файл'} · {doc.kind.toUpperCase()} · {wordCount(
                    doc.stats.tokens,
                  )}</small
                ></span
              >
              <span class={'readiness ' + doc.stats.band}>{bandNames[doc.stats.band]}</span>
            </label>
          {:else}<p class="plan-note">Текстов по этому запросу нет.</p>{/each}
        </div>
      {/if}
      {#if library.documents.length < 2}<button class="secondary" onclick={upload}
          ><Icon name="plus" size={17} />Добавить текст</button
        >{/if}
    </div>
    <div class="plan-controls">
      <span class="section-icon"><Icon name="layers" /></span>
      <h2>Ваша подборка</h2>
      <p aria-live="polite">Выбрано: {documentCount(chosen.length)}</p>
      <label
        >Сколько слов подобрать<select bind:value={limit}
          >{#each sizes as n (n)}<option value={n}>{wordCount(n)}</option>{/each}</select
        ></label
      >
      <button class="primary full" disabled={chosen.length < 2} onclick={calculate}
        >Составить план</button
      >
      {#if result && request}<button
          class="text-btn"
          onclick={() => {
            editing = false
            error = ''
          }}>Вернуться к плану</button
        >{/if}
    </div>
  </section>
{:else if busy && !result}<p class="loading" role="status">
    Подбираем слова по всем выбранным текстам…
  </p>
{:else if result}
  {@const gain = result.understoodAfter - result.understoodBefore}
  <section class="plan-overview">
    <div>
      <h2 bind:this={resultHeading} tabindex="-1">
        {result.picks.length
          ? 'Если выучить ' + wordCount(result.picks.length)
          : 'В подборке нет новых слов'}
      </h2>
      <p>
        {documentCount(result.documents.length)} · {unitCount(result.sentences)}. Прогноз по текущему
        словарю.
      </p>
    </div>
    {#if result.picks.length}<button
        class="primary"
        disabled={busy || savingWord}
        onclick={exportCards}><Icon name="download" size={17} />Скачать CSV для Anki</button
      >{/if}
    <dl class="plan-numbers">
      <div>
        <dt>Понятно сейчас</dt>
        <dd>{pct(result.understoodBefore / result.sentences)}</dd>
      </div>
      <div>
        <dt>После изучения</dt>
        <dd>{pct(result.understoodAfter / result.sentences)}</dd>
      </div>
      <div>
        <dt>Новых понятных фрагментов</dt>
        <dd>+{num(gain)}</dd>
      </div>
    </dl>
  </section>
  <div class="plan-results">
    <section class="plan-words">
      <h2>Что выучить</h2>
      {#if result.picks.length}
        <p>
          Слова перечислены в порядке изучения. У каждого есть пример и число фрагментов, которые оно
          откроет на этом шаге.
        </p>
        <ol>
          {#each result.picks as pick (pick.lemma)}
            <li>
              <details>
                <summary
                  ><strong lang="en">{pick.lemma}</strong><span>+{num(pick.unlocked)}</span><Icon
                    name="down"
                    size={14}
                  /></summary
                >
                <p lang="en">{pick.example}</p>
                <small
                  >{pick.sourceTitle} · Встречается в {pick.documentCount} из {result.documents
                    .length} текстов</small
                >
                <div class="plan-word-actions">
                  <button
                    class="secondary"
                    disabled={busy || savingWord}
                    onclick={() => mark(pick.lemma, 'known')}
                    ><Icon name="check" size={15} />Знаю слово</button
                  >
                  <button
                    class="text-btn"
                    disabled={busy || savingWord}
                    title="Исключить из расчётов для всей библиотеки"
                    onclick={() => mark(pick.lemma, 'ignored')}>Не учитывать</button
                  >
                </div>
              </details>
            </li>
          {/each}
        </ol>
      {:else}<p class="plan-note">
          Все слова выбранных текстов знакомы или исключены. Можно выбрать другие тексты.
        </p>{/if}
    </section>
    <section class="plan-impact">
      <h2>По текстам</h2>
      <p>Доля понятных фрагментов до и после изучения подборки.</p>
      <ul>
        {#each result.documents as doc (doc.id)}<li>
            <strong lang="en">{doc.title}</strong>
            <span
              >{pct(doc.understoodBefore / doc.sentences)} →
              <b>{pct(doc.understoodAfter / doc.sentences)}</b></span
            >
            <div class="plan-track" aria-hidden="true">
              <i style:width={(doc.understoodAfter / doc.sentences) * 100 + '%'}></i><b
                style:width={(doc.understoodBefore / doc.sentences) * 100 + '%'}
              ></b>
            </div>
          </li>{/each}
      </ul>
    </section>
  </div>
{:else if error && request}<button
    class="secondary"
    onclick={() => {
      if (request) request = { ...request }
    }}>Повторить расчёт</button
  >{/if}
