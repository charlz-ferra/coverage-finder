<script lang="ts">
  import { importVocabulary, previewVocabulary, type LibraryState } from '../lib/client'
  import { readTextFile } from './format'
  import Icon from './Icon.svelte'
  let { finish }: { finish: (state: LibraryState) => void } = $props()
  let input: HTMLInputElement,
    content = $state(''),
    name = $state(''),
    rows = $state<string[][]>([]),
    columns = $state(0),
    column = $state(0),
    skip = $state(false),
    error = $state(''),
    busy = $state(false),
    dragging = $state(false)
  async function select(file?: File) {
    if (!file) return
    busy = true
    error = ''
    rows = []
    try {
      const raw = await readTextFile(file)
      const preview = await previewVocabulary(raw)
      if (!preview.rows.length) throw new Error('В файле нет слов. Выберите другой файл.')
      content = raw
      rows = preview.rows
      columns = preview.columnCount
      column = 0
      name = file.name
      skip = /^(word|lemma|front|english|слово|английский)$/i.test(rows[0]?.[0]?.trim() ?? '')
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
      input.value = ''
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
<input
  type="file"
  accept=".csv,.tsv,.txt"
  aria-label="Файл словаря"
  bind:this={input}
  onchange={(e) => select(e.currentTarget.files?.[0])}
  hidden
/>
<button
  class:dragging
  class="drop-area"
  disabled={busy}
  onclick={() => input.click()}
  ondragover={(e) => {
    e.preventDefault()
    dragging = true
  }}
  ondragleave={() => (dragging = false)}
  ondrop={(e) => {
    e.preventDefault()
    e.stopPropagation()
    dragging = false
    void select(e.dataTransfer?.files[0])
  }}
  ><Icon name="upload" size={27} /><strong>{name || 'Выберите или перетащите файл'}</strong><small
    >CSV, TXT или TSV</small
  ></button
>
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
