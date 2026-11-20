<script lang="ts">
  import Icon from './Icon.svelte'
  import { bandNames, cover, num, pct, plural, wordCount } from './format'
  import { rememberLayout, type CatalogLayout, type CatalogPreferences } from './catalog'
  import type { LibraryState, LibraryDocument } from '../lib/client'
  import './library.css'

  let {
    state: library,
    catalog,
    updateCatalog,
    recentId,
    open,
    upload,
    vocab,
    quiz,
    details,
    dictionary,
  }: {
    state: LibraryState
    catalog: CatalogPreferences
    updateCatalog: (patch: Partial<CatalogPreferences>) => void
    recentId: string
    open: (id: string) => void
    upload: () => void
    vocab: () => void
    quiz: () => void
    details: () => void
    dictionary: () => void
  } = $props()

  let filtering = $state(false)
  let searchInput: HTMLInputElement
  let catalogHeading: HTMLHeadingElement
  const tabs = [
    { id: 'all', label: 'Все тексты' },
    { id: 'mine', label: 'Мои файлы' },
    { id: 'demo', label: 'Демо' },
  ] as const
  const counts = $derived({
    all: library.documents.length,
    mine: library.documents.filter((d) => !d.isDemo).length,
    demo: library.documents.filter((d) => d.isDemo).length,
  })
  const ready = $derived(library.documents.filter((d) => d.stats.band === 'ready').length)
  const recent = $derived(library.documents.find((d) => d.id === recentId))
  const featured = $derived(library.profile === 'personal' ? (recent ?? library.documents[0]) : null)
  const activeFilters = $derived(Number(catalog.format !== 'all') + Number(catalog.band !== 'all'))
  const filtered = $derived.by(() => {
    const { collection, format, band, query, sort } = catalog
    const search = query.toLocaleLowerCase('en').trim()
    return library.documents
      .filter(
        (d) =>
          (collection === 'all' || (collection === 'demo') === d.isDemo) &&
          (format === 'all' || format === d.kind) &&
          (band === 'all' || band === d.stats.band) &&
          (d.title + ' ' + d.author).toLocaleLowerCase('en').includes(search),
      )
      .sort(
        (a, b) =>
          (sort === 'title'
            ? 0
            : sort === 'len'
              ? a.stats.tokens - b.stats.tokens
              : sort === 'tokens'
                ? b.stats.cTok - a.stats.cTok
                : b.stats.cSent - a.stats.cSent) || a.title.localeCompare(b.title, 'en'),
      )
  })
  function layout(value: CatalogLayout) {
    updateCatalog({ layout: value })
    rememberLayout(value)
  }
  function showAll(readyOnly = false) {
    updateCatalog({ collection: 'all', query: '', format: 'all', band: readyOnly ? 'ready' : 'all' })
    if (readyOnly) filtering = true
    catalogHeading.focus({ preventScroll: true })
    catalogHeading.scrollIntoView({ block: 'start' })
  }
  function shortcut(e: KeyboardEvent) {
    const target = e.target
    if (
      e.key !== '/' ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      document.querySelector('dialog[open]') ||
      !(target instanceof HTMLElement) ||
      target.closest('input, textarea, select, [contenteditable=true]')
    )
      return
    e.preventDefault()
    searchInput.focus()
  }
  const base = import.meta.env.BASE_URL
</script>

<svelte:window onkeydown={shortcut} />
<div class="page-heading library-heading">
  <div>
    <h1>Моя библиотека</h1>
    <p>Книги и субтитры по вашему уровню английского.</p>
  </div>
  <button class="primary" onclick={upload}><Icon name="plus" size={18} />Добавить текст</button>
</div>

<section
  class="reading-banner"
  aria-label={featured ? 'Рекомендация для чтения' : 'Настроить словарь'}
>
  <div class="banner-copy">
    {#if featured}
      <span class="banner-label"
        ><Icon name="bookmark" size={14} />{recent ? 'Вы читали' : 'По вашему словарю'}</span
      >
      <h2 lang="en">{featured.title}</h2>
      <p>
        {pct(featured.stats.cSent)} предложений со знакомыми словами · {wordCount(
          featured.stats.tokens,
        )}
      </p>
      <div class="banner-actions">
        <button class="banner-primary" onclick={() => open(featured.id)}
          ><Icon name="book" size={17} />{recent ? 'Продолжить чтение' : 'Открыть текст'}</button
        ><button class="banner-secondary" onclick={vocab}>Обновить словарь</button>
      </div>
    {:else}
      <span class="banner-label"
        ><Icon name="bookmark" size={14} />{library.profile === 'demo'
          ? 'Демо-словарь'
          : 'Личный словарь'}</span
      >
      <h2>Оцените свой словарь</h2>
      <p>
        Загрузите знакомые слова из Anki или пройдите короткий тест, чтобы получить свой рейтинг
        текстов.
      </p>
      <div class="banner-actions">
        <button class="banner-primary" onclick={vocab}
          ><Icon name="upload" size={16} />Загрузить словарь</button
        ><button class="banner-secondary" onclick={quiz}>Пройти тест</button>
      </div>
    {/if}
  </div>
  <div class="banner-picture" aria-hidden="true">
    <img src={base + 'art/reading-desk.webp'} alt="" />
  </div>
</section>

<div class="library-stats" aria-label="Показатели библиотеки">
  <button onclick={() => showAll()}
    ><span class="metric-icon total"><Icon name="library" size={22} /></span><span class="metric-copy"
      ><strong>{num(counts.all)}</strong><span>Текстов в библиотеке</span></span
    ></button
  >
  <button onclick={dictionary}
    ><span class="metric-icon vocabulary"><Icon name="words" size={22} /></span><span
      class="metric-copy"><strong>{num(library.knownCount)}</strong><span>Знакомых слов</span></span
    ></button
  >
  <button onclick={() => showAll(true)}
    ><span class="metric-icon available"><Icon name="sprout" size={22} /></span><span
      class="metric-copy"><strong>{num(ready)}</strong><span>Можно читать</span></span
    ></button
  >
</div>

<section class="catalog-board" aria-labelledby="catalog-heading">
  <div class="catalog-title">
    <h2 id="catalog-heading" tabindex="-1" bind:this={catalogHeading}>Каталог текстов</h2>
    <div class="catalog-title-tools">
      <button
        class="catalog-help"
        title="Как считается рейтинг"
          aria-label="О рейтинге"
        onclick={details}><Icon name="info" size={16} /><span>О рейтинге</span></button
      >
      <div class="layout-switch" aria-label="Вид каталога">
        <button
          title="Список"
          aria-label="Список"
          aria-pressed={catalog.layout === 'list'}
          onclick={() => layout('list')}><Icon name="list" size={17} /></button
        >
        <button
          title="Книжная полка"
          aria-label="Книжная полка"
          aria-pressed={catalog.layout === 'shelf'}
          onclick={() => layout('shelf')}><Icon name="grid" size={17} /></button
        >
      </div>
    </div>
  </div>
  <div class="catalog-toolbar">
    <div class="collection-tabs" aria-label="Источник текстов">
      {#each tabs as tab (tab.id)}
        <button
          aria-pressed={catalog.collection === tab.id}
          onclick={() => updateCatalog({ collection: tab.id })}
          >{tab.label}<span>{counts[tab.id]}</span></button
        >
      {/each}
    </div>
    <div class="catalog-inputs">
      <label class="catalog-search"
        ><Icon name="search" size={17} /><input
          bind:this={searchInput}
          value={catalog.query}
          oninput={(e) => updateCatalog({ query: e.currentTarget.value })}
          type="search"
          aria-label="Найти текст"
          placeholder="Найти текст"
        />{#if !catalog.query}<kbd aria-hidden="true">/</kbd>{/if}</label
      >
      <button
        class="open-filters"
        class:applied={activeFilters > 0 || catalog.sort !== 'sent'}
        aria-expanded={filtering}
        aria-controls="catalog-filters"
        onclick={() => (filtering = !filtering)}
        ><Icon name="filter" size={16} />Фильтры{#if activeFilters}<span>{activeFilters}</span
          >{/if}</button
      >
    </div>
  </div>
  {#if filtering}
    <div class="catalog-filters" id="catalog-filters">
      <label
        >Формат<select
          value={catalog.format}
          onchange={(e) => updateCatalog({ format: e.currentTarget.value })}
          ><option value="all">Все форматы</option><option value="txt">TXT</option><option
            value="epub">EPUB</option
          ><option value="srt">SRT</option></select
        ></label
      >
      <label
        >Готовность<select
          value={catalog.band}
          onchange={(e) => updateCatalog({ band: e.currentTarget.value })}
          ><option value="all">Все уровни</option
          >{#each Object.entries(bandNames) as [key, name] (key)}<option value={key}>{name}</option
            >{/each}</select
        ></label
      >
      <label
        >Сортировка<select
          value={catalog.sort}
          onchange={(e) => updateCatalog({ sort: e.currentTarget.value })}
          ><option value="sent">По понятным предложениям</option><option value="tokens"
            >По покрытию слов</option
          ><option value="len">Сначала короткие</option><option value="title">По названию</option
          ></select
        ></label
      >
      <button
        class="text-btn"
        onclick={() => updateCatalog({ format: 'all', band: 'all', sort: 'sent' })}>Сбросить</button
      >
    </div>
  {/if}
  {#snippet status(doc: LibraryDocument)}
    <span class={'readiness ' + doc.stats.band}
      ><span class="band-dot"></span>{bandNames[doc.stats.band]}</span
    >
  {/snippet}
  {#snippet volume(doc: LibraryDocument)}
    {#if cover(doc)}<img class="volume-cover" src={cover(doc)} alt="" />
    {:else}<span class="volume-cover file-cover"
        ><Icon name={doc.kind === 'srt' ? 'test' : 'book'} size={20} /></span
      >{/if}
  {/snippet}
  {#snippet bookTitle(doc: LibraryDocument)}
    <button class="open-title" aria-label={'Открыть ' + doc.title} onclick={() => open(doc.id)}>
      <strong lang="en">{doc.title}</strong>
    </button>
  {/snippet}
  {#if !filtered.length}
    <div class="catalog-empty">
      <span class="empty-icon"><Icon name="search" size={24} /></span>
      <h3>
        {catalog.collection === 'mine' && !counts.mine
          ? 'Здесь будут ваши файлы'
          : 'Тексты не найдены'}
      </h3>
      <p>
        {catalog.collection === 'mine' && !counts.mine
          ? 'Добавьте книгу или субтитры в формате EPUB, TXT или SRT.'
          : 'Попробуйте другое название или измените фильтры.'}
      </p>
      {#if !counts.all || (catalog.collection === 'mine' && !counts.mine)}<button
          class="primary"
          onclick={upload}>Добавить текст</button
        >{:else}<button class="secondary" onclick={() => showAll()}>Показать все тексты</button>{/if}
    </div>
  {:else if catalog.layout === 'list'}
    <div class="catalog-list">
      <table class="catalog-table">
        <thead
          ><tr>
            <th scope="col">Текст</th><th scope="col">Покрытие слов</th><th
              scope="col"
              aria-sort={catalog.sort === 'sent' ? 'descending' : 'none'}
              ><button
                onclick={() => {
                  updateCatalog({ sort: 'sent' })
                  filtering = true
                }}>Понятно целиком<Icon name="sort" size={13} /></button
              ></th
            ><th scope="col">+1 слово</th><th scope="col">Готовность</th><th
              scope="col"
              class="open-col"
              aria-label="Открыть текст"
            ></th>
          </tr></thead
        ><tbody>
          {#each filtered as doc (doc.id)}
            <tr>
              <td class="text-cell">
                <div class="document-link">
                  {@render volume(doc)}
                  <span class="document-name">
                    {@render bookTitle(doc)}
                    <span>{doc.author || 'Мой файл'} · {doc.kind.toUpperCase()} · {wordCount(doc.stats.tokens)}</span>
                  </span>
                </div>
              </td>
              <td class="metric-cell coverage-cell"
                ><span class="compact-label">Покрытие</span><span>{pct(doc.stats.cTok)}</span><i
                  class="coverage-track"><i style:width={doc.stats.cTok * 100 + '%'}></i></i
                ></td
              >
              <td class="metric-cell sentence-cell"
                ><span class="compact-label">Понятно целиком</span>{pct(doc.stats.cSent)}</td
              >
              <td class="metric-cell plus-cell"
                ><span class="compact-label">+1 слово</span>{pct(doc.stats.cI1)}</td
              >
              <td class="band-cell">{@render status(doc)}</td>
              <td class="open-col"
                ><span aria-hidden="true"><Icon name="chevron" size={15} /></span></td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="book-shelf">
      {#each filtered as doc (doc.id)}
        <div class="shelf-book">
          <span class={'shelf-stage tone-' + ((doc.id.charCodeAt(0) + doc.id.length) % 5)}
            >{@render volume(doc)}</span
          >
          <span class="shelf-data"
            >{@render status(doc)}{@render bookTitle(doc)}<span
              >{doc.author || doc.kind.toUpperCase()}</span
            ><small>Понятно целиком <b>{pct(doc.stats.cSent)}</b></small></span
          >
        </div>
      {/each}
    </div>
  {/if}
  {#if filtered.length}<p class="catalog-count">
      {num(filtered.length)}
      {plural(filtered.length, ['текст', 'текста', 'текстов'])} в списке
    </p>{/if}
</section>
