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
  let pressedBackdrop = false

  function outside(event: PointerEvent | MouseEvent) {
    if (event.target !== dialog) return false
    const box = dialog.getBoundingClientRect()
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
  }
  onMount(() => {
    const opened = dialog
    opened.showModal()
    const existing = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      opened.close()
      document.body.style.overflow = existing
    }
  })
</script>

<dialog
  bind:this={dialog}
  class="work-dialog"
  class:wide
  aria-label={title}
  oncancel={(e) => {
    e.preventDefault()
    onclose()
  }}
  onpointerdown={(event) => (pressedBackdrop = outside(event))}
  onclick={(event) => {
    if (pressedBackdrop && outside(event)) onclose()
  }}
>
  <div class="modal-heading">
    <h2>{title}</h2>
    <button class="icon-btn" aria-label="Закрыть" onclick={onclose}><Icon name="close" /></button>
  </div>
  <div class="work-dialog-body">{@render children()}</div>
</dialog>

<style>
  dialog.work-dialog {
    --dialog-paper: #fffef9;
    width: min(35rem, calc(100vw - 2rem));
    max-height: min(90dvh, 56rem);
    padding: 0;
    background: var(--dialog-paper);
    border: 1px solid #cbd4c8;
    border-radius: 1.15rem;
    box-shadow:
      0 1.8rem 6rem #15291e42,
      0 0.3rem 1rem #15291e1c;
    overflow: hidden;
  }
  dialog.work-dialog[open] {
    display: flex;
    flex-direction: column;
  }
  dialog.work-dialog.wide {
    width: min(54rem, calc(100vw - 2rem));
  }
  dialog.work-dialog::backdrop {
    background: #10231bc4;
    backdrop-filter: blur(4px);
  }
  .modal-heading {
    margin: 0;
    flex: none;
    padding: 1.25rem 1.65rem 1.05rem;
    border-bottom: 1px solid #e1e4d9;
    gap: 1rem;
  }
  .modal-heading h2 {
    font-size: clamp(1.45rem, 4vw, 1.85rem);
  }
  .modal-heading .icon-btn {
    width: 2.75rem;
    height: 2.75rem;
    background: #f1f3ea;
    color: #344e3e;
    border: 1px solid #e0e5d8;
    border-radius: 50%;
  }
  .modal-heading .icon-btn:hover {
    background: #e0e8da;
  }
  .work-dialog-body {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 1.4rem 1.65rem 1.65rem;
  }
  .work-dialog-body :global(.intro) {
    font-size: 1rem;
    line-height: 1.6;
  }
  .work-dialog-body :global(.primary),
  .work-dialog-body :global(.secondary),
  .work-dialog-body :global(.danger-btn) {
    min-height: 2.75rem;
  }
  .work-dialog-body :global(.modal-actions) {
    flex-wrap: wrap;
  }
  @media (max-width: 560px) {
    dialog.work-dialog,
    dialog.work-dialog.wide {
      width: 100%;
      max-width: 100%;
      margin: auto 0 0;
      max-height: 94dvh;
      border-radius: 1.15rem 1.15rem 0 0;
      border-bottom: 0;
    }
    .modal-heading {
      padding: 0.95rem 1.1rem 0.8rem;
    }
    .work-dialog-body {
      padding: 1.05rem 1.1rem max(1.25rem, env(safe-area-inset-bottom));
    }
    .work-dialog-body :global(.modal-actions) {
      position: sticky;
      bottom: -1.25rem;
      z-index: 2;
      padding: .7rem 0 .15rem;
      background: var(--dialog-paper);
      border-top: 1px solid #e1e4d9;
    }
    .work-dialog-body :global(.modal-actions > button:only-child) {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    dialog.work-dialog[open] {
      animation: reveal-dialog 0.18s ease-out;
    }
    @keyframes reveal-dialog {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
  }
</style>
