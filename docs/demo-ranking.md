# Демо-библиотека при трёх размерах словаря

В таблице каждый отрывок оценён для трёх условных читателей. Им знакомы первые 3 000, 5 000 или 8 000 лемм английского частотного списка. Проценты описывают конкретный отрывок, объём которого указан во второй колонке.

Три числа в ячейке — покрытие слов, доля полностью знакомых предложений и доля предложений с одной новой леммой, в процентах. Отрывки упорядочены по доле полностью знакомых предложений для профиля в 3 000 лемм. [Методика](methodology.md)

| Источник отрывка | Токены | 3 000 лемм | 5 000 лемм | 8 000 лемм |
| --- | ---: | ---: | ---: | ---: |
| [A Kind Brother](https://www.gutenberg.org/ebooks/14668) | 196 | 99,0 / 85,7 / 14,3 | 99,5 / 92,9 / 7,1 | 99,5 / 92,9 / 7,1 |
| [Pride and Prejudice](https://www.gutenberg.org/ebooks/1342) | 852 | 93,2 / 53,3 / 20,0 | 94,1 / 56,7 / 20,0 | 95,2 / 58,3 / 23,3 |
| [Alice's Adventures in Wonderland](https://www.gutenberg.org/ebooks/11) | 1251 | 95,0 / 42,9 / 32,1 | 96,4 / 50,0 / 35,7 | 97,0 / 55,4 / 35,7 |
| [The Secret Garden](https://www.gutenberg.org/ebooks/17396) | 1207 | 91,9 / 40,3 / 20,8 | 93,8 / 47,2 / 26,4 | 95,0 / 51,4 / 27,8 |
| [Black Beauty](https://www.gutenberg.org/ebooks/271) | 783 | 93,0 / 35,1 / 35,1 | 94,8 / 43,2 / 35,1 | 97,8 / 78,4 / 8,1 |
| [The Mice in Council](https://www.gutenberg.org/ebooks/21) | 95 | 97,9 / 33,3 / 66,7 | 97,9 / 33,3 / 66,7 | 100,0 / 100,0 / 0,0 |
| [The Adventures of Sherlock Holmes](https://www.gutenberg.org/ebooks/1661) | 1247 | 89,5 / 32,4 / 29,6 | 92,9 / 35,2 / 35,2 | 94,7 / 47,9 / 31,0 |
| [The Time Machine](https://www.gutenberg.org/ebooks/35) | 1179 | 86,3 / 32,1 / 17,9 | 90,4 / 39,7 / 24,4 | 92,5 / 42,3 / 26,9 |
| [The Wonderful Wizard of Oz](https://www.gutenberg.org/ebooks/55) | 1144 | 92,9 / 31,6 / 29,8 | 94,9 / 42,1 / 33,3 | 96,2 / 50,9 / 33,3 |
| [Little Women](https://www.gutenberg.org/ebooks/514) | 1274 | 91,9 / 30,4 / 24,6 | 94,7 / 40,6 / 31,9 | 95,8 / 46,4 / 34,8 |
| [The Wind in the Willows](https://www.gutenberg.org/ebooks/289) | 1201 | 86,1 / 29,2 / 25,0 | 91,0 / 38,9 / 26,4 | 93,6 / 45,8 / 25,0 |
| [Moby-Dick](https://www.gutenberg.org/ebooks/2701) | 1250 | 87,0 / 25,8 / 17,7 | 90,7 / 33,9 / 22,6 | 93,4 / 41,9 / 22,6 |
| [Treasure Island](https://www.gutenberg.org/ebooks/120) | 1173 | 91,6 / 15,0 / 25,0 | 94,5 / 25,0 / 30,0 | 96,1 / 37,5 / 30,0 |
| [The Call of the Wild](https://www.gutenberg.org/ebooks/215) | 1188 | 86,2 / 7,7 / 23,1 | 90,1 / 21,2 / 25,0 | 93,7 / 30,8 / 28,8 |

Сверить значения с текущими данными можно командой `pnpm --filter @coverage/core test`. Чтобы пересчитать таблицу после изменения данных или алгоритма, выполните `pnpm --filter @coverage/core exec vitest run tests/demo-ranking.test.ts -u`.
