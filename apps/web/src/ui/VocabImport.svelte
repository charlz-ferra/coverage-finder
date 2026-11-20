<script lang="ts">
  import { importVocabulary, previewVocabulary, type LibraryState } from '../lib/client'
  import { readTextFile } from './format'
  import FileDrop from './FileDrop.svelte'
  let { finish }: { finish: (state: LibraryState) => void } = $props()
  let content = $state(''),
    name = $state(''),
    rows = $state<string[][]>([]),
    columns = $state(0),
    column = $state(0),
    skip = $state(false),
    error = $state(''),
    busy = $state(false)
  async function select(file?: File) {
    if (!file) return
    busy = true
    error = ''
    try {
      const raw = await readTextFile(file)
      const preview = await previewVocabulary(raw)
      if (!preview.rows.length) throw new Error('В файле нет слов. Выберите другой файл.')
      content = raw
      rows = preview.rows
      columns = preview.columnCount
      name = file.name
      const namedColumn = rows[0].findIndex((field) =>
        /^(word|lemma|front|english|слово|английский)$/i.test(field.trim()),
      )
      column = Math.max(namedColumn, 0)
      skip = namedColumn >= 0
    } catch (e) {
      error = file.name + ' — ' + (e as Error).message
    } finally {
      busy = false
    }
  }
  async function save() {
    busy = true
    error = ''
    try {
      finish(await importVocabulary(content, column, skip))
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
    }
  }
</script>

<p class="intro">
  Загрузите текстовую выгрузку Anki или список знакомых английских слов. Для списка достаточно одного
  слова в строке.
</p>
<FileDrop
  label="Файл словаря"
  accept=".csv,.tsv,.txt"
  title="Выберите или перетащите файл"
  caption="CSV, TXT или TSV"
  selected={name}
  {busy}
  choose={(files) => select(files[0])}
/>
{#if rows.length}
  <div class="form-line">
    <label
      >Колонка со словами<select bind:value={column}
        >{#each Array(columns) as _, i (i)}<option value={i}>Колонка {i + 1}</option>{/each}</select
      ></label
    ><label class="checkbox"><input type="checkbox" bind:checked={skip} />Пропустить заголовок</label>
  </div>
  <h3 class="minor-heading">Первые строки</h3>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users scroll the file preview.) -->
  <div tabindex="0" role="region" aria-label="Предпросмотр CSV" class="preview-table">
    <table>
      <thead
        ><tr>
          {#each Array(columns) as _, i (i)}
            <th scope="col"
              ><button class="column-name" aria-pressed={column === i} onclick={() => (column = i)}
                >Колонка {i + 1}</button
              ></th
            >
          {/each}
        </tr></thead
      >
      <tbody
        >{#each rows as row, i (i)}<tr class:muted={skip && i === 0}
            >{#each row as v, j (j)}<td class:highlighted={j === column}>{v || '—'}</td>{/each}</tr
          >{/each}</tbody
      >
    </table>
  </div>
  {#if rows.length < 6}<p class="hint">
      В файле мало строк. Проверьте выбранную колонку перед импортом.
    </p>{/if}
{/if}
<details class="guide">
  <summary>Как выгрузить знакомые слова из Anki</summary>
  <ol>
    <li>
      В окне Browse выберите колоду и добавьте к запросу <code>-is:new</code>. Для карточек с
      интервалом от 21 дня используйте <code>prop:ivl&gt;=21</code>.
    </li>
    <li>Выделите найденные записи и экспортируйте их в формате Notes in Plain Text.</li>
    <li>Загрузите файл и выберите поле с английским словом.</li>
  </ol>
</details>
{#if error}<p class="error" role="alert">{error}</p>{/if}
{#if rows.length}<div class="modal-actions">
    <button class="primary" disabled={busy} onclick={save}
      >{busy ? 'Обрабатываем…' : 'Импортировать слова'}</button
    >
  </div>{/if}

<style>
  .form-line {
    margin: 0.45rem 0;
    gap: 1rem;
  }
  .form-line label {
    font-size: 0.875rem;
  }
  .form-line select {
    min-height: 2.75rem;
    background-color: #fffef9;
  }
  .form-line label.checkbox {
    min-height: 2.75rem;
    padding: 0.25rem 0;
    gap: 0.4rem;
    font-size: 0.875rem;
  }
  .checkbox input {
    width: 1.1rem;
    height: 1.1rem;
  }
  .preview-table {
    border-radius: 0.6rem;
    max-height: 12.5rem;
    background: white;
  }
  .preview-table th {
    position: sticky;
    top: 0;
    padding: 0;
    background: #edf0e7;
  }
  .column-name {
    width: 100%;
    min-height: 2.5rem;
    padding: 0.4rem 0.7rem;
    text-align: left;
    color: #4b5f4d;
    font-size: 0.85rem;
  }
  .column-name[aria-pressed='true'] {
    color: #284835;
    background: #e1ead8;
    box-shadow: inset 0 -2px #617f55;
  }
  .column-name:focus-visible {
    outline-offset: -3px;
  }
  .preview-table .highlighted {
    background: #f2f6ed;
    color: #263d2d;
  }
  .preview-table .muted {
    opacity: 1;
    color: #5d665d;
    font-style: italic;
  }
  .guide {
    margin-top: 1.1rem;
    padding-top: 0.45rem;
  }
  .guide summary {
    padding: 0.6rem 0;
    min-height: 2.75rem;
  }
  .modal-actions {
    margin-top: 0.85rem;
  }
  @media (max-width: 420px) {
    .form-line {
      gap: 0.45rem;
    }
    .form-line label.checkbox {
      margin-left: auto;
    }
  }
</style>
