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
  async function previous() {
    answers = answers.slice(0, -1)
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
    if (
      e.repeat ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      !started ||
      !['ArrowLeft', 'ArrowRight'].includes(e.key)
    )
      return
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
  <progress
    class="quiz-progress"
    aria-label="Пройдено карточек"
    value={answers.length}
    max={items.length}
  ></progress>
  <div class="quiz-word">
    <small>Вы знаете это слово?</small>
    <h3 lang="en" tabindex="-1" bind:this={wordNode}>{items[answers.length].word}</h3>
  </div>
  <div class="quiz-actions">
    <button class="secondary" onclick={() => answer(false)}
      ><Icon name="close" size={17} />Не знаю <kbd aria-hidden="true">←</kbd></button
    ><button class="primary" onclick={() => answer(true)}
      ><Icon name="check" size={17} />Знаю <kbd aria-hidden="true">→</kbd></button
    >
  </div>
  <div class="quiz-navigation">
    <button class="text-btn quiz-back" disabled={!answers.length} onclick={previous}>
      К предыдущему слову
    </button>
  </div>
{:else}<p class="intro">{busy ? 'Пересчитываем библиотеку…' : 'Ответы сохранены в этой форме.'}</p>
  {#if error}<button class="secondary" onclick={submit}>Повторить расчёт</button>{/if}{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}

<style>
  .quiz-intro {
    padding: 0.35rem 0 1.4rem;
  }
  .quiz-intro .illustrated-icon {
    width: 3.6rem;
    height: 3.8rem;
    border-radius: 0.6rem 0.35rem 0.35rem 0.6rem;
    border-left: 0.3rem solid #b79a58;
    background: #2c4738;
    color: #eee4c1;
    transform: rotate(-5deg);
    box-shadow: 3px 3px 0 #d8d8c6;
    margin: 0.15rem 0 1.15rem;
  }
  .quiz-intro h3 {
    font-size: clamp(1.6rem, 3.6vw, 2rem);
  }
  .quiz-intro p {
    font-size: 1rem;
    line-height: 1.6;
    max-width: 39ch;
    margin: 0.75rem auto 1rem;
  }
  .quiz-meta {
    font-size: 0.875rem;
    gap: 1rem;
    color: #4c6152;
  }
  .progress-label {
    color: #425b4a;
    font-size: 0.9rem;
    font-weight: 550;
  }
  .quiz-progress {
    display: block;
    margin: 0.55rem 0 1rem;
    height: 0.35rem;
  }
  .quiz-progress::-webkit-progress-value {
    background: #365e46;
  }
  .quiz-word {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    min-height: 12rem;
    padding: 1.8rem 1.25rem;
    background: linear-gradient(145deg, #fbf8eb, #f2efdf);
    border: 1px solid #d9d2b8;
    border-radius: 0.8rem;
    box-shadow:
      0 3px 0 -1px #ece8d7,
      0 4px 0 -1px #d6d3bd;
    margin: 0.2rem 0 1.35rem;
  }
  .quiz-word::before {
    content: '';
    position: absolute;
    pointer-events: none;
    inset: 0.45rem;
    border: 1px solid #e2ddc6;
    border-radius: 0.48rem;
  }
  .quiz-word h3 {
    margin: 0;
    font-size: clamp(2.25rem, 8vw, 3.5rem);
    color: #233e32;
    overflow-wrap: anywhere;
  }
  .quiz-word small {
    color: #5b6354;
    font-size: 0.88rem;
  }
  .quiz-actions {
    gap: 0.75rem;
  }
  .quiz-actions button {
    min-height: 3.2rem;
    font-size: 1rem;
  }
  .quiz-actions kbd {
    border: 1px solid currentColor;
    opacity: 0.8;
    border-radius: 0.2rem;
    padding: 0 0.18rem;
    font: inherit;
    font-size: 0.75rem;
  }
  .quiz-navigation {
    text-align: center;
    margin-top: 0.25rem;
  }
  .quiz-back {
    min-height: 2.75rem;
    margin: 0 auto;
    font-size: 0.875rem;
  }
  .quiz-back:disabled {
    visibility: hidden;
  }
  @media (hover: none) and (pointer: coarse) {
    .quiz-actions kbd {
      display: none;
    }
  }
</style>
