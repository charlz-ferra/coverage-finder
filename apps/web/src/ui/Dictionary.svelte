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
  const latest = $derived(progress.at(-1))
  const baseline = $derived(
    progress
      .filter((p) => p.day <= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .at(-1) ?? progress[0],
  )
  const newReady = $derived(
    latest && baseline ? latest.readyTitles.filter((t) => !baseline.readyTitles.includes(t)) : [],
  )
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
  <section class="panel">
    <span class="eyebrow">{library.profile === 'demo' ? 'Демо-словарь' : 'Известные леммы'}</span>
    <h2 class="big-number">{num(library.knownCount)}</h2>
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
  <section class="panel">
    <span class="eyebrow">За последние 30 дней</span>
    <h2>Прогресс чтения</h2>
    {#if progress.length > 1 && latest && baseline && baseline.day !== latest.day}<p>
        Знакомых слов: {num(baseline.knownCount)} → {num(latest.knownCount)}.
      </p>
      <h3 class="minor-heading">Стало можно читать</h3>
      {#if newReady.length}<ul>
          {#each newReady as title, i (i)}<li>{title}</li>{/each}
        </ul>{:else}<p>Новых текстов с покрытием от 98% пока нет.</p>{/if}
    {:else}<p>
        Здесь появятся книги, которые достигли покрытия 98% после обновления вашего словаря в другой
        день.
      </p>
      {#if latest}<small>Первое наблюдение · {latest.day}</small>{/if}{/if}
  </section>
</div>
<section class="panel">
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
      {#each filtered.slice(page * 40, (page + 1) * 40) as w (w.lemma)}<li>
          <strong lang="en">{w.lemma}</strong><small
            >{w.source === 'anki' ? 'Импорт' : w.source === 'test' ? 'Тест' : 'Вручную'}</small
          ><select
            aria-label={'Статус ' + w.lemma}
            value={w.status}
            onchange={(e) => update(w.lemma, e.currentTarget.value as WordStatus)}
            >{#each Object.entries(statusNames) as [v, l] (v)}<option value={v}>{l}</option
              >{/each}</select
          >
        </li>{/each}
    </ul>
    {#if filtered.length > 40}<div class="pagination">
        <button class="secondary" disabled={!page} onclick={() => page--}>Назад</button><span
          >Страница {page + 1}</span
        ><button
          class="secondary"
          disabled={(page + 1) * 40 >= filtered.length}
          onclick={() => page++}>Дальше</button
        >
      </div>{/if}
  {:else}<p class="inline-note">
      {library.words.length
        ? 'Подходящих слов нет.'
        : 'Здесь появятся ваши отметки в текстах и слова из импорта или теста.'}
    </p>{/if}
</section>
{#if error}<p class="error" role="alert">{error}</p>{/if}
