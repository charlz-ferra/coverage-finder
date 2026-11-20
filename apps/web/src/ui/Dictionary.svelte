<script lang="ts">
  import {
    getProgress,
    getLastTest,
    setWord,
    type LibraryState,
    type WordStatus,
  } from '../lib/client'
  import Icon from './Icon.svelte'
  import { num, pct, statusNames, wordCount } from './format'
  let {
    state: library,
    upload,
    quiz,
    changed,
    notify,
  }: {
    state: LibraryState
    upload: () => void
    quiz: () => void
    changed: (s: LibraryState) => void
    notify: (s: string) => void
  } = $props()
  let query = $state(''),
    filter = $state('all'),
    page = $state(0),
    error = $state(''),
    progress = $state<Awaited<ReturnType<typeof getProgress>>>([]),
    result = $state<Awaited<ReturnType<typeof getLastTest>>>(null)
  $effect(() => {
    void library.vocabVersion
    let live = true
    Promise.all([getProgress(), getLastTest()])
      .then(([p, r]) => {
        if (live) {
          progress = p
          result = r
        }
      })
      .catch((e) => (error = e.message))
    return () => {
      live = false
    }
  })
  let filtered = $derived(
    library.words
      .filter(
        (w) =>
          (filter === 'all' || w.status === filter) && w.lemma.includes(query.toLowerCase().trim()),
      )
      .sort((a, b) => a.lemma.localeCompare(b.lemma)),
  )
  const pages = $derived(Math.max(1, Math.ceil(filtered.length / 40)))
  const currentPage = $derived(Math.min(page, pages - 1))
  const latest = $derived(progress.at(-1))
  const baseline = $derived(
    progress
      .filter((p) => p.day <= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .at(-1) ?? progress[0],
  )
  const newReady = $derived(
    latest && baseline ? latest.readyTitles.filter((t) => !baseline.readyTitles.includes(t)) : [],
  )
  function displayDay(day: string) {
    const date = new Date(day + 'T12:00:00')
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : day
  }
  async function update(word: string, status: WordStatus) {
    try {
      changed(await setWord(word, status))
      notify(word + ' · ' + statusNames[status])
    } catch (e) {
      error = (e as Error).message
    }
  }
</script>

<div class="page-heading">
  <div>
    <h1>Мой словарь</h1>
    <p>Знакомые слова, исключения и результаты теста.</p>
  </div>
  <button class="primary" onclick={upload}><Icon name="upload" size={17} />Загрузить словарь</button>
</div>
<div class="dictionary-top">
  <section class="panel vocabulary-summary">
    <div class="section-symbol" aria-hidden="true"><Icon name="words" size={24} /></div>
    <span class="eyebrow">{library.profile === 'demo' ? 'Демо-словарь' : 'Известные леммы'}</span>
    <h2 class="big-number">{wordCount(library.knownCount)}</h2>
    <p>
      {library.profile === 'demo'
        ? 'Рейтинг использует частотный список. Загрузите свой словарь или пройдите тест.'
        : 'Изученные слова из Anki, теста и ваших отметок в текстах.'}
    </p>
    <button class="secondary" onclick={quiz}><Icon name="test" size={16} />Пройти тест</button
    >{#if result}<p class="hint">
        Последний тест: {wordCount(result.size)} · ложных «да» {pct(result.falseAlarmRate)}.
      </p>{/if}
  </section>
  <section class="panel reading-progress">
    <span class="eyebrow">За последние 30 дней</span>
    <h2>Прогресс чтения</h2>
    {#if progress.length > 1 && latest && baseline && baseline.day !== latest.day}
      <dl class="period-comparison">
        <div>
          <dt>
            {displayDay(baseline.day)}
          </dt>
          <dd>{wordCount(baseline.knownCount)}</dd>
        </div>
        <div>
          <dt>Последняя запись</dt>
          <dd>{wordCount(latest.knownCount)}</dd>
        </div>
      </dl>
      <h3 class="minor-heading">Стало можно читать</h3>
      {#if newReady.length}<ul>
          {#each newReady as title, i (i)}<li lang="en">{title}</li>{/each}
        </ul>{:else}<p>Новых текстов с покрытием от 98% пока нет.</p>{/if}
    {:else}<div class="progress-empty">
        <span class="progress-symbol"><Icon name="chart" size={21} /></span>
        <p>
          {latest
            ? 'Обновите словарь в другой день, чтобы увидеть, какие книги стали доступны.'
            : 'Добавьте свой словарь. Здесь появятся книги, в которых вы узнаёте не меньше 98% слов.'}
        </p>
      </div>
      {#if latest}<small
          >Первое наблюдение · {displayDay(latest.day)}</small
        >{/if}{/if}
  </section>
</div>
<section class="panel word-collection">
  <div class="section-heading">
    <h2>Мои слова</h2>
    <span class="subtle">{num(filtered.length)}</span>
  </div>
  <div class="word-filters">
    <label class="search"
      ><Icon name="search" size={16} /><input
        aria-label="Найти слово"
        type="search"
        placeholder="Найти слово"
        bind:value={query}
        oninput={() => (page = 0)}
      /></label
    ><select aria-label="Статус слова" bind:value={filter} onchange={() => (page = 0)}
      ><option value="all">Все статусы</option
      >{#each Object.entries(statusNames) as [value, label] (value)}<option {value}>{label}</option
        >{/each}</select
    >
  </div>
  {#if filtered.length}<ul class="word-rows">
      {#each filtered.slice(currentPage * 40, (currentPage + 1) * 40) as w (w.lemma)}<li>
          <span class="entry-meta"
            ><strong lang="en">{w.lemma}</strong><small
              >{w.source === 'anki'
                ? 'Из импорта'
                : w.source === 'test'
                  ? 'Из теста'
                  : 'Отмечено вручную'}</small
            ></span
          ><select
            data-status={w.status}
            aria-label={'Статус ' + w.lemma}
            value={w.status}
            onchange={(e) => update(w.lemma, e.currentTarget.value as WordStatus)}
            >{#each Object.entries(statusNames) as [v, l] (v)}<option value={v}>{l}</option
              >{/each}</select
          >
        </li>{/each}
    </ul>
    {#if filtered.length > 40}<div class="pagination">
        <button class="secondary" disabled={!currentPage} onclick={() => (page = currentPage - 1)}
          >Назад</button
        ><span>{currentPage + 1} из {pages}</span><button
          class="secondary"
          disabled={currentPage + 1 >= pages}
          onclick={() => (page = currentPage + 1)}>Дальше</button
        >
      </div>{/if}
  {:else}
    <div class="collection-empty">
      <span class="empty-symbol"
        ><Icon name={library.words.length ? 'search' : 'book'} size={25} /></span
      >
      {#if library.words.length}
        <h3>Подходящих слов нет</h3>
        <button
          class="text-btn"
          onclick={() => {
            query = ''
            filter = 'all'
            page = 0
          }}>Сбросить поиск и фильтр</button
        >
      {:else}
        <h3>Пока нет личных отметок</h3>
        <p>Нажмите на слово в тексте или загрузите список из Anki, чтобы добавить его сюда.</p>
      {/if}
    </div>
  {/if}
</section>
{#if error}<p class="error" role="alert">{error}</p>{/if}

<style>
  .dictionary-top {
    align-items: stretch;
  }
  .vocabulary-summary,
  .reading-progress,
  .word-collection {
    min-width: 0;
  }
  .vocabulary-summary {
    position: relative;
    overflow: hidden;
    background: #eaf0e4;
    border-color: #d3dccd;
  }
  .section-symbol {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 0.8rem;
    color: #3f624b;
    background: #f7f9f1;
    border: 1px solid #d2ddce;
  }
  .vocabulary-summary .eyebrow {
    max-width: calc(100% - 3.2rem);
  }
  .vocabulary-summary .big-number {
    color: #294634;
    font: 500 clamp(2rem, 4vw, 3rem)/1.1 var(--serif) !important;
    margin: 0.6rem 2.1rem 0.5rem 0;
    font-variant-numeric: lining-nums;
  }
  .vocabulary-summary > p {
    max-width: 43ch;
    font-size: 1rem;
    margin-top: 0.5rem;
  }
  .vocabulary-summary .secondary {
    background: #fbfcf7;
    min-height: 2.75rem;
  }
  .reading-progress h2 {
    margin-top: 0.45rem;
  }
  .progress-empty {
    display: flex;
    gap: 0.85rem;
    align-items: flex-start;
    margin: 1.15rem 0 0.75rem;
  }
  .progress-empty p,
  .collection-empty p {
    color: #536252;
    font-size: 0.94rem;
  }
  .progress-symbol,
  .empty-symbol {
    display: grid;
    place-items: center;
    flex: none;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.7rem;
    background: #f0efe3;
    color: #6c6948;
  }
  .reading-progress > small {
    color: #5c685a;
  }
  .period-comparison {
    display: flex;
    gap: 1rem;
    margin: 1.15rem 0;
    flex-wrap: wrap;
  }
  .period-comparison > div + div {
    border-left: 1px solid #d9ded3;
    padding-left: 1rem;
  }
  .period-comparison dt {
    font-size: 0.8rem;
    color: #526052;
  }
  .period-comparison dd {
    margin: 0.22rem 0 0;
    font-weight: 600;
  }
  .word-collection .section-heading {
    justify-content: start;
  }
  .word-collection .subtle {
    background: #e9eee3;
    color: #3c583f;
    border-radius: 0.45rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.85rem;
  }
  .word-filters {
    align-items: stretch;
  }
  .word-filters .search {
    width: min(22rem, 100%);
    min-width: 0;
    height: 2.75rem;
  }
  .word-filters .search input {
    width: 100%;
    font-size: 0.93rem;
  }
  .word-filters > select,
  .word-rows select {
    min-height: 2.75rem;
    font-size: 0.88rem;
  }
  .collection-empty {
    border-top: 1px solid #e1e4d9;
    padding: 2rem 0.8rem 1.25rem;
    text-align: center;
  }
  .empty-symbol {
    margin: 0 auto 0.65rem;
    width: 3rem;
    height: 3rem;
    background: #f0f3e9;
    color: #4f704e;
  }
  .collection-empty h3 {
    font: 500 1.45rem/1.3 var(--serif);
    margin-bottom: 0.35rem;
  }
  .collection-empty p {
    max-width: 48ch;
    margin: 0 auto;
  }
  .collection-empty .text-btn {
    min-height: 2.75rem;
  }
  .word-rows li {
    justify-content: space-between;
    gap: 1rem;
  }
  .entry-meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .entry-meta strong {
    min-width: 0;
    overflow-wrap: anywhere;
    font: 600 1.16rem var(--serif);
  }
  .entry-meta small {
    margin-left: 0;
  }
  .word-rows select {
    max-width: 52%;
  }
  .word-rows select[data-status='known'] {
    border-color: #c3d2c1;
    background-color: #f2f6ed;
    color: #36513c;
  }
  @media (max-width: 560px) {
    .dictionary-top {
      gap: 0.75rem;
    }
    .word-filters {
      flex-wrap: wrap;
    }
    .word-filters .search {
      flex: 1 1 9rem;
    }
    .word-filters > select {
      flex: 0 1 auto;
      max-width: 100%;
    }
  }
</style>
