<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import Icon from './Icon.svelte'
  import FileDrop from './FileDrop.svelte'
  import { addFile, type LibraryState } from '../lib/client'
  let {
    initial = [],
    changed,
    done,
  }: { initial?: File[]; changed: (state: LibraryState) => void; done: () => void } = $props()
  let busy = $state(false),
    current = $state(''),
    position = $state(0),
    total = $state(0),
    log = $state<{ name: string; message: string; ok: boolean }[]>([]),
    controller: AbortController | undefined
  async function process(files: File[]) {
    if (!files.length || busy) return
    busy = true
    total = files.length
    position = 0
    controller = new AbortController()
    for (const file of files) {
      if (controller.signal.aborted) break
      position++
      current = file.name
      try {
        const next = await addFile(file, controller.signal)
        changed(next)
        log = [...log, { name: file.name, message: 'Добавлен', ok: true }]
      } catch (e) {
        log = [...log, { name: file.name, message: (e as Error).message, ok: false }]
      }
    }
    busy = false
    current = ''
  }
  onMount(() => {
    if (initial.length) void process(initial)
  })
  onDestroy(() => controller?.abort())
</script>

<p class="intro">
  Добавьте английскую книгу, текст или субтитры. Файлы обрабатываются в этом браузере.
</p>
<FileDrop
  label="Файлы текстов"
  accept=".txt,.srt,.epub"
  multiple
  title="Выберите или перетащите файлы"
  caption="EPUB, SRT, TXT · до 24 МБ каждый"
  {busy}
  choose={process}
/>
{#if busy}<div class="import-progress" aria-live="polite">
    {#if total > 1}<span>Файл {position} из {total}</span>{/if}
    <strong>{current}</strong><progress aria-label="Разбор файла"></progress><button
      class="text-btn"
      onclick={() => controller?.abort()}>Отменить</button
    >
  </div>{/if}
<ul class="file-log" aria-live="polite">
  {#each log as result, i (i)}<li class:failed={!result.ok}>
      <Icon name={result.ok ? 'checkCircle' : 'info'} size={17} /><span
        ><strong>{result.name}</strong><small class:error-text={!result.ok}>{result.message}</small
        ></span
      >
    </li>{/each}
</ul>
{#if log.length && !busy}<div class="modal-actions">
    <button class="primary" onclick={done}>Вернуться в библиотеку</button>
  </div>{/if}

<style>
  .import-progress {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 0.4rem;
  }
  .import-progress span {
    grid-column: 1/-1;
    font-size: 0.8rem;
    color: #556452;
  }
  .import-progress strong {
    overflow-wrap: anywhere;
  }
  .import-progress progress {
    grid-column: 1/-1;
    grid-row: 3;
    margin: 0;
  }
  .import-progress .text-btn {
    min-height: 2.75rem;
    grid-column: 2;
  }
  .file-log:not(:empty) {
    max-height: 15rem;
    overflow-y: auto;
    border-block: 1px solid #e0e5d9;
  }
  .file-log li {
    padding: 0.7rem 0.2rem;
    gap: 0.75rem;
  }
  .file-log li:last-child {
    border-bottom: none;
  }
  .file-log li.failed {
    color: #904c39;
  }
  .file-log li span {
    min-width: 0;
  }
</style>
