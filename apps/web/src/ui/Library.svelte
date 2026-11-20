<script lang="ts">
  import Icon from './Icon.svelte'
  import { bandNames, cover, num, pct, plural, wordCount } from './format'
  import type { LibraryState, LibraryDocument } from '../lib/client'
  let {
    state: library,
    open,
    upload,
    vocab,
    quiz,
    details,
  }: {
    state: LibraryState
    open: (id: string) => void
    upload: () => void
    vocab: () => void
    quiz: () => void
    details: () => void
  } = $props()
  let collection = $state('all'),
    query = $state(''),
    format = $state('all'),
    band = $state('all'),
    sort = $state('sent'),
    filtering = $state(false)
  const tabs = [
    { id: 'all', label: 'Все тексты' },
    { id: 'mine', label: 'Мои файлы' },
    { id: 'demo', label: 'Демо' },
  ]
  const counts = $derived({
    all: library.documents.length,
    mine: library.documents.filter((d) => !d.isDemo).length,
    demo: library.documents.filter((d) => d.isDemo).length,
  })
  const ready = $derived(library.documents.filter((d) => d.stats.band === 'ready').length)
  const filtered = $derived(
    library.documents
      .filter(
        (d) =>
          (collection === 'all' || (collection === 'demo') === d.isDemo) &&
          (format === 'all' || d.kind === format) &&
          (band === 'all' || d.stats.band === band) &&
          (d.title + ' ' + d.author).toLowerCase().includes(query.toLowerCase().trim()),
      )
      .sort(compare),
  )
  function compare(a: LibraryDocument, b: LibraryDocument) {
    return (
      (sort === 'title'
        ? 0
        : sort === 'len'
          ? a.stats.tokens - b.stats.tokens
          : sort === 'tokens'
            ? b.stats.cTok - a.stats.cTok
            : b.stats.cSent - a.stats.cSent) || a.title.localeCompare(b.title, 'en')
    )
  }
  const base = import.meta.env.BASE_URL
</script>

<div class="page-heading">
  <div>
    <h1>Моя библиотека</h1>
    <p>Выберите, что читать или смотреть на английском.</p>
  </div>
  <button class="primary" onclick={upload}><Icon name="plus" size={18} />Добавить текст</button>
</div>
<div class="overview">
  <section class="feature">
    <div class="feature-copy">
      <div class="feature-label">
        <span class="live-dot"></span>{library.profile === 'demo' ? 'Демо-словарь' : 'Личный словарь'}
      </div>
      <h2>{library.profile === 'demo' ? 'Оцените свой словарь' : 'Ваш словарь растёт'}</h2>
      <p>
        {library.profile === 'demo'
          ? 'Сейчас рейтинг рассчитан по демо-словарю. Добавьте знакомые слова, чтобы получить свой.'
          : 'Обновите список знакомых слов из Anki, чтобы пересчитать рейтинг всей библиотеки.'}
      </p>
      <div class="feature-actions">
        <button class="light-btn" onclick={vocab}
          ><Icon name="upload" size={16} />{library.profile === 'demo'
            ? 'Загрузить словарь'
            : 'Обновить словарь'}</button
        ><button class="ghost-light" onclick={quiz}>Пройти тест</button>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="orbit one"></div>
      <div class="orbit two"></div>
      <div class="orbit three"></div>
      <div class="star s1">✦</div>
      <div class="star s2">✧</div>
      <div class="star s3">✦</div>
      <img class="hero-book h-left" src={base + 'art/treasure.webp'} alt="" /><img
        class="hero-book h-right"
        src={base + 'art/oz.webp'}
        alt=""
      /><img class="hero-book h-center" src={base + 'art/alice.webp'} alt="" />
    </div>
  </section>
  <section class="summary">
    <h2>Обзор библиотеки</h2>
    <div>
      <span class="stat-icon"><Icon name="library" size={17} /></span><span>Текстов в библиотеке</span
      ><strong>{num(counts.all)}</strong>
    </div>
    <div>
      <span class="stat-icon"><Icon name="words" size={17} /></span><span>Знакомых слов</span><strong
        >{num(library.knownCount)}</strong
      >
    </div>
    <div>
      <span class="stat-icon green"><Icon name="checkCircle" size={17} /></span><span
        >Можно читать</span
      ><strong>{num(ready)}</strong>
    </div>
  </section>
</div>
<section class="catalog" aria-labelledby="catalog-heading">
  <div class="section-heading">
    <h2 id="catalog-heading">Каталог текстов</h2>
    <button class="text-btn help-link" onclick={details}
      ><Icon name="info" size={16} />Как считается рейтинг</button
    >
  </div>
  <div class="catalog-controls">
    <div class="segments" aria-label="Источник текстов">
      {#each tabs as tab (tab.id)}<button
          class:active={collection === tab.id}
          aria-pressed={collection === tab.id}
          onclick={() => (collection = tab.id)}
          >{tab.label}<span>{counts[tab.id as keyof typeof counts]}</span></button
        >{/each}
    </div>
    <div class="control-right">
      <label class="search"
        ><Icon name="search" size={16} /><input
          type="search"
          placeholder="Найти текст"
          aria-label="Найти текст"
          bind:value={query}
        /></label
      >
      <button
        class:chosen={filtering || band !== 'all' || format !== 'all' || sort !== 'sent'}
        class="filter"
        aria-expanded={filtering}
        onclick={() => (filtering = !filtering)}><Icon name="filter" size={16} />Фильтры</button
      >
    </div>
  </div>
  {#if filtering}
    <div class="filter-bar">
      <label
        >Формат<select bind:value={format}
          ><option value="all">Все форматы</option><option value="txt">TXT</option><option
            value="epub">EPUB</option
          ><option value="srt">SRT</option></select
        ></label
      >
      <label
        >Готовность<select bind:value={band}
          ><option value="all">Все уровни</option
          >{#each Object.entries(bandNames) as [key, name] (key)}<option value={key}>{name}</option
            >{/each}</select
        ></label
      >
      <label
        >Сортировка<select bind:value={sort}
          ><option value="sent">По понятным предложениям</option><option value="tokens"
            >По покрытию слов</option
          ><option value="len">Сначала короткие</option><option value="title">По названию</option
          ></select
        ></label
      >
      <button
        class="text-btn"
        onclick={() => {
          format = 'all'
          band = 'all'
          sort = 'sent'
          query = ''
        }}>Сбросить</button
      >
    </div>
  {/if}
  {#if filtered.length}
    <div class="table-wrap">
      <table class="catalog-table">
        <thead
          ><tr
            ><th scope="col">Название</th><th scope="col">Покрытие слов</th><th scope="col"
              ><button
                onclick={() => {
                  sort = 'sent'
                  filtering = true
                }}>Понятно целиком <Icon name="sort" size={14} /></button
              ></th
            ><th scope="col">+1 слово</th><th scope="col">Готовность</th><th
              scope="col"
              aria-label="Открыть"
            ></th></tr
          ></thead
        >
        <tbody
          >{#each filtered as doc (doc.id)}
            <tr>
              <td
                ><button class="book-cell" onclick={() => open(doc.id)}
                  >{#if cover(doc)}<img src={cover(doc)} alt="" class="thumb" />{:else}<span
                      class="thumb blank-cover"
                      ><Icon name={doc.kind === 'srt' ? 'test' : 'book'} /></span
                    >{/if}<span class="book-meta"
                    ><strong lang="en">{doc.title}</strong><small
                      >{doc.author || 'Мой файл'}<b>·</b>{doc.kind.toUpperCase()}<b>·</b>{wordCount(
                        doc.stats.tokens,
                      )}</small
                    ><small class="mobile-metrics"
                      >Покрытие {pct(doc.stats.cTok)} · +1 слово {pct(doc.stats.cI1)}</small
                    ></span
                  ></button
                ></td
              >
              <td
                ><div class="coverage-bar">
                  <span>{pct(doc.stats.cTok)}</span><i
                    ><em style:width={doc.stats.cTok * 100 + '%'}></em></i
                  >
                </div></td
              >
              <td>{pct(doc.stats.cSent)}</td><td>{pct(doc.stats.cI1)}</td><td
                ><span class={'badge ' + doc.stats.band}><i></i>{bandNames[doc.stats.band]}</span></td
              >
              <td
                ><button
                  class="row-go"
                  aria-label={'Открыть ' + doc.title}
                  onclick={() => open(doc.id)}><Icon name="chevron" size={16} /></button
                ></td
              >
            </tr>
          {/each}</tbody
        >
      </table>
    </div>
    <p class="table-foot">
      {num(filtered.length)}
      {plural(filtered.length, ['текст', 'текста', 'текстов'])} в списке
    </p>
  {:else}
    <div class="empty">
      <Icon name="library" size={30} />
      <h3>
        {collection === 'mine' && !counts.mine ? 'Здесь будут ваши файлы' : 'Тексты не найдены'}
      </h3>
      <p>
        {collection === 'mine' && !counts.mine
          ? 'Добавьте книгу или субтитры в формате EPUB, TXT или SRT.'
          : 'Попробуйте другой запрос или измените фильтры.'}
      </p>
      {#if !counts.all || (collection === 'mine' && !counts.mine)}<button
          class="primary"
          onclick={upload}>Добавить текст</button
        >{:else}<button
          class="secondary"
          onclick={() => {
            query = ''
            band = 'all'
            format = 'all'
            collection = 'all'
          }}>Показать все тексты</button
        >{/if}
    </div>
  {/if}
</section>
