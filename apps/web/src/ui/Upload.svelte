<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import Icon from './Icon.svelte'
  import { addFile, type LibraryState } from '../lib/client'
  let {
    initial = [],
    changed,
    done,
  }: { initial?: File[]; changed: (state: LibraryState) => void; done: () => void } = $props()
  let input: HTMLInputElement,
    busy = $state(false),
    dragging = $state(false),
    current = $state(''),
    log = $state<{ name: string; message: string; ok: boolean }[]>([]),
    controller: AbortController | undefined
  async function process(files: File[]) {
    if (!files.length || busy) return
    busy = true
    controller = new AbortController()
    for (const file of files) {
      if (controller.signal.aborted) break
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
    if (input) input.value = ''
  }
  onMount(() => {
    if (initial.length) void process(initial)
  })
  onDestroy(() => controller?.abort())
</script>

<p class="intro">
  Добавьте английскую книгу, текст или субтитры. Файлы обрабатываются в этом браузере.
</p>
<input
  hidden
  type="file"
  multiple
  accept=".txt,.srt,.epub"
  bind:this={input}
  aria-label="Файлы текстов"
  onchange={(e) => process(Array.from(e.currentTarget.files ?? []))}
/>
<button
  class="drop-area"
  class:dragging
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
    void process(Array.from(e.dataTransfer?.files ?? []))
  }}
  ><Icon name="upload" size={30} /><strong>Выберите или перетащите файлы</strong><small
    >EPUB, SRT, TXT · до 24 МБ каждый</small
  ></button
>
{#if busy}<div class="import-progress" aria-live="polite">
    Разбираем {current}…<progress></progress><button
      class="text-btn"
      onclick={() => controller?.abort()}>Отменить</button
    >
  </div>{/if}
<ul class="file-log" aria-live="polite">
  {#each log as result, i (i)}<li>
      <Icon name={result.ok ? 'checkCircle' : 'info'} size={17} /><span
        ><strong>{result.name}</strong><small class:error-text={!result.ok}>{result.message}</small
        ></span
      >
    </li>{/each}
</ul>
{#if log.length && !busy}<div class="modal-actions">
    <button class="primary" onclick={done}>Вернуться в библиотеку</button>
  </div>{/if}
