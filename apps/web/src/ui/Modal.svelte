<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import Icon from './Icon.svelte'
  let {
    title,
    onclose,
    children,
    wide = false,
  }: { title: string; onclose: () => void; children: Snippet; wide?: boolean } = $props()
  let dialog: HTMLDialogElement
  onMount(() => {
    dialog.showModal()
    const existing = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = existing
    }
  })
</script>

<dialog
  bind:this={dialog}
  class:wide
  aria-label={title}
  oncancel={(e) => {
    e.preventDefault()
    onclose()
  }}
  onclick={(e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        onclose()
    }
  }}
>
  <div class="modal-heading">
    <h2>{title}</h2>
    <button class="icon-btn" aria-label="Закрыть" onclick={onclose}><Icon name="close" /></button>
  </div>
  {@render children()}
</dialog>
