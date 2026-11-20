# Два плана для «Алисы» и «Страны Оз»

Демо-словарь: первые 3 000 лемм, без ручных отметок. Выбраны одни и те же два отрывка, в одном порядке, по 20 карточек. В колонках «Прирост» — предложения, которые открывает именно этот шаг.

| Шаг | Без пропуска | Прирост | С пропуском вероятных имён | Прирост |
| ---: | --- | ---: | --- | ---: |
| 1 | dorothy | +3 | after | +2 |
| 2 | dinah | +3 | cyclone | +2 |
| 3 | after | +2 | suddenly | +1 |
| 4 | cyclone | +2 | thump | +2 |
| 5 | toto | +2 | cellar | +1 |
| 6 | suddenly | +1 | slowly | +1 |
| 7 | thump | +2 | curtsey | +1 |
| 8 | cellar | +1 | loudly | +1 |
| 9 | slowly | +1 | sleepy | +1 |
| 10 | curtsey | +1 | sway | +1 |
| 11 | loudly | +1 | whirl | +1 |
| 12 | sleepy | +1 | alas | +1 |
| 13 | sway | +1 | aloud | +1 |
| 14 | whirl | +1 | antipathy | +1 |
| 15 | alas | +1 | dip | +1 |
| 16 | aloud | +1 | downward | +1 |
| 17 | antipathy | +1 | dreamy | +1 |
| 18 | dearly | +1 | gaunt | +1 |
| 19 | dip | +1 | generally | +1 |
| 20 | downward | +1 | glance | +1 |

| Отрывок | Понятно сейчас | После, без пропуска | После, с пропуском |
| --- | ---: | ---: | ---: |
| Alice's Adventures in Wonderland | 24/56 (42,9%) | 38/56 (67,9%) | 36/56 (64,3%) |
| The Wonderful Wizard of Oz | 18/57 (31,6%) | 32/57 (56,1%) | 29/57 (50,9%) |
| **Оба текста** | 42/113 (37,2%) | 70/113 (61,9%) | 65/113 (57,5%) |

Воспроизвести: `pnpm --filter @coverage/core exec vitest run tests/demo-study-plan.test.ts`. [Как устроен отбор и почему меняется подборка](methodology.md#пропуск-вероятных-имён).
