<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { applyTest, getTest, type LibraryState } from '../lib/client'
  import Icon from './Icon.svelte'
  let { finish }: { finish: (value: LibraryState) => void } = $props()
  let items = $state<{ word: string }[]>([]),
    answers = $state<boolean[]>([]),
    error = $state(''),
    busy = $state(false),
    started = $state(false)
  let wordNode = $state<HTMLHeadingElement>()
  onMount(() => {
    getTest()
      .then((v) => (items = v))
      .catch((e) => (error = e.message))
  })
  async function answer(yes: boolean) {
    if (!started || busy || answers.length >= items.length) return
    answers = [...answers, yes]
    if (answers.length === items.length) {
      await submit()
      return
    }
    await tick()
    wordNode?.focus()
  }
  async function submit() {
    busy = true
    error = ''
    try {
      finish(await applyTest([...answers]))
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
    }
  }
  function key(e: KeyboardEvent) {
    if (e.repeat || !started || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return
    e.preventDefault()
    void answer(e.key === 'ArrowRight')
  }
</script>

<svelte:window onkeydown={key} />
{#if !started}
  <div class="quiz-intro">
    <span class="illustrated-icon"><Icon name="words" size={36} /></span>
    <h3>Сколько английских слов вы знаете?</h3>
    <p>
      Перед вами появятся 80 слов, в том числе вымышленные. Отмечайте «Знаю», если можете объяснить
      значение без подсказки.
    </p>
    <div class="quiz-meta">
      <span><Icon name="clock" size={16} />Около 3 минут</span><span
        ><Icon name="test" size={16} />80 карточек</span
      >
    </div>
  </div>
  <button
    class="primary full"
    disabled={!items.length}
    onclick={async () => {
      started = true
      await tick()
      wordNode?.focus()
    }}>Начать тест</button
  >
{:else if answers.length < items.length}
  <div class="progress-label">
    <span>Карточка {answers.length + 1} из {items.length}</span><span
      >{Math.round((answers.length / items.length) * 100)}%</span
    >
  </div>
  <progress value={answers.length} max={items.length}></progress>
  <div class="quiz-word">
    <small>Вы знаете это слово?</small>
    <h3 lang="en" tabindex="-1" bind:this={wordNode}>{items[answers.length].word}</h3>
  </div>
  <div class="quiz-actions">
    <button class="secondary" onclick={() => answer(false)}
      ><Icon name="close" size={17} />Не знаю <kbd>←</kbd></button
    ><button class="primary" onclick={() => answer(true)}
      ><Icon name="check" size={17} />Знаю <kbd>→</kbd></button
    >
  </div>
  {#if answers.length > 0}<button
      class="text-btn quiz-back"
      onclick={() => (answers = answers.slice(0, -1))}>К предыдущему слову</button
    >{/if}
{:else}<p class="intro">{busy ? 'Пересчитываем библиотеку…' : 'Ответы сохранены в этой форме.'}</p>
  {#if error}<button class="secondary" onclick={submit}>Повторить расчёт</button>{/if}{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}
