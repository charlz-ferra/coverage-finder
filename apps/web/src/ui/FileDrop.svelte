<script lang="ts">
  import Icon from './Icon.svelte'
  let {
    label,
    accept,
    title,
    caption,
    choose,
    multiple = false,
    selected = '',
    busy = false,
  }: {
    label: string
    accept: string
    title: string
    caption: string
    choose: (files: File[]) => void
    multiple?: boolean
    selected?: string
    busy?: boolean
  } = $props()
  let input: HTMLInputElement
  let dragging = $state(false)
  function pick(list: FileList | null | undefined) {
    if (busy || !list?.length) return
    choose(Array.from(list).slice(0, multiple ? list.length : 1))
  }
</script>

<input
  hidden
  type="file"
  {accept}
  {multiple}
  aria-label={label}
  bind:this={input}
  onchange={(event) => {
    pick(event.currentTarget.files)
    event.currentTarget.value = ''
  }}
/>
<button
  type="button"
  class="picker"
  class:dragging
  class:compact={selected}
  disabled={busy}
  onclick={() => input.click()}
  ondragover={(event) => {
    event.preventDefault()
    if (!busy) dragging = true
  }}
  ondragleave={(event) => {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget))
      dragging = false
  }}
  ondrop={(event) => {
    event.preventDefault()
    event.stopPropagation()
    dragging = false
    pick(event.dataTransfer?.files)
  }}
>
  <span class="picker-icon"><Icon name={selected ? 'doc' : 'upload'} size={23} /></span>
  <span class="picker-copy">
    <strong>{selected || title}</strong>
    <small>{caption}</small>
  </span>
  {#if selected}<span class="replace">Заменить</span>{/if}
</button>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 9rem;
    gap: 0.6rem;
    padding: 1rem;
    border: 1.5px dashed #92a38e;
    border-radius: 0.75rem;
    color: #294937;
    background: #f2f5ec;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .picker:hover:not(:disabled),
  .picker.dragging {
    background: #e7efdf;
    border-color: #557654;
  }
  .picker-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 2.75rem;
    height: 2.75rem;
    border: 1px solid #d6dfcf;
    border-radius: 0.7rem;
    background: #fffefa;
  }
  .picker-copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .picker-copy strong {
    font-size: 1rem;
    overflow-wrap: anywhere;
  }
  .picker-copy small {
    color: #526451;
    font-size: 0.83rem;
    font-weight: 400;
  }
  .picker.compact {
    min-height: 4.5rem;
    flex-direction: row;
    justify-content: start;
    gap: 0.8rem;
    padding: 0.75rem;
    text-align: left;
    border-style: solid;
  }
  .compact .picker-copy strong {
    font-size: 0.9rem;
  }
  .replace {
    margin-left: auto;
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
