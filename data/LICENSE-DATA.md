# Источники и лицензии данных

## Английские частоты

Файл `en/frequency.json` содержит написания и частоты из FrequencyWords 2018, составитель Hermit Dave. Корпусом послужил OpenSubtitles2018 из проекта OPUS (Pierre Lison, Jörg Tiedemann и участники OpenSubtitles). При подготовке отобраны записи из английских букв с целым положительным числом употреблений. Приложение группирует формы по леммам в памяти браузера и использует первые 10 000 лемм. Частоты разговорного языка в субтитрах могут отличаться от частот в книгах. Данные и производный частотный список распространяются по CC BY-SA 4.0. [Исходный список](https://github.com/hermitdave/FrequencyWords/tree/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/en) · [OpenSubtitles2018](https://opus.nlpl.eu/OpenSubtitles/corpus/version/OpenSubtitles) · [Лицензия](en/LICENSE-FREQUENCY.txt)

## Английские словоформы

Файл `en/forms.json` подготовлен из английской таблицы Lemmatization Lists, Michal Boleslav Měchura. Производная база содержит пары из строчных букв в обратном порядке «форма → лемма». Для формы с несколькими леммами сохранён первый вариант из исходной таблицы. Производная база открыта под ODbL 1.0. У проекта-источника опубликован перечень языковых ресурсов, в том числе список английских форм Yasumasa Someya. [Исходные данные и атрибуция](https://github.com/michmech/lemmatization-lists/tree/943c9d5f04ed714d9a76970fdb00437e94bb9afb) · [Лицензия](en/LICENSE-FORMS.txt)

## Словарь проверки написаний

Файл `en/dictionary.json` содержит строчные английские основы из словаря Hunspell en_US, версия SCOWL 2020.12.07. При сборке убраны флаги Hunspell и записи с прописными буквами. Полные уведомления Kevin Atkinson и перечисленных в исходном словаре участников прилагаются. [Исходный словарь](https://github.com/wooorm/dictionaries/tree/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/en) · [Лицензии и уведомления](en/LICENSE-SCOWL.txt)

## Демо-библиотека

Использованы отрывки из исторических английских изданий, перешедших в общественное достояние в США. Для каждого отрывка взят непрерывный фрагмент основного текста, удалены технические переносы строк и подчёркивание курсива. Басня «The Mice in Council» и рассказ «A Kind Brother» включены целиком. Из рассказа убраны номера учебных абзацев. Названия, авторы и ссылки на оригиналы входят в `demo/library.json`. Файлы источников получены из зеркала GITenberg. Снимки источников и контрольные суммы зафиксированы в скрипте сборки. [Зеркало](https://github.com/GITenberg) · [Условия Project Gutenberg](demo/LICENSE-GUTENBERG.txt)

| Произведение | Автор | Первое издание | Источник |
| --- | --- | ---: | --- |
| Alice's Adventures in Wonderland | Lewis Carroll | 1865 | [№ 11](https://www.gutenberg.org/ebooks/11) |
| The Wonderful Wizard of Oz | L. Frank Baum | 1900 | [№ 55](https://www.gutenberg.org/ebooks/55) |
| The Adventures of Sherlock Holmes, «A Scandal in Bohemia» | Arthur Conan Doyle | 1892 | [№ 1661](https://www.gutenberg.org/ebooks/1661) |
| Treasure Island | Robert Louis Stevenson | 1883 | [№ 120](https://www.gutenberg.org/ebooks/120) |
| Pride and Prejudice | Jane Austen | 1813 | [№ 1342](https://www.gutenberg.org/ebooks/1342) |
| The Time Machine | H. G. Wells | 1895 | [№ 35](https://www.gutenberg.org/ebooks/35) |
| Little Women, часть I | Louisa May Alcott | 1868 | [№ 514](https://www.gutenberg.org/ebooks/514) |
| The Call of the Wild | Jack London | 1903 | [№ 215](https://www.gutenberg.org/ebooks/215) |
| The Secret Garden | Frances Hodgson Burnett | 1911 | [№ 17396](https://www.gutenberg.org/ebooks/17396) |
| The Wind in the Willows | Kenneth Grahame | 1908 | [№ 289](https://www.gutenberg.org/ebooks/289) |
| Moby-Dick | Herman Melville | 1851 | [№ 2701](https://www.gutenberg.org/ebooks/2701) |
| Black Beauty | Anna Sewell | 1877 | [№ 271](https://www.gutenberg.org/ebooks/271) |
| A Kind Brother, урок XVI из McGuffey's Second Eclectic Reader | William Holmes McGuffey | 1879, исправленное издание | [№ 14668](https://www.gutenberg.org/ebooks/14668) |
| The Mice in Council, из Aesop's Fables | Эзоп, перевод George Fyler Townsend | 1867, английский перевод | [№ 21](https://www.gutenberg.org/ebooks/21) |

This eBook is for the use of anyone anywhere at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the Project Gutenberg License included with this eBook or online at www.gutenberg.org.
