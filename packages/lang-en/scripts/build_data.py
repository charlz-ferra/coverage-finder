"""Rebuild the separate English datasets and public-domain text excerpts (Python 3.10+)."""

import argparse
import hashlib
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW = "https://raw.githubusercontent.com/"
LEXICONS = {
    "forms": ("michmech/lemmatization-lists/943c9d5f04ed714d9a76970fdb00437e94bb9afb/lemmatization-en.txt", "e9fe1da4006af7a1ee8c54e6"),
    "frequency": ("hermitdave/FrequencyWords/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/en/en_50k.txt", "5351ff405b1126ef555791dd"),
    "dictionary": ("wooorm/dictionaries/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/en/index.dic", "f0b1a234bd178bdd01875b2a"),
    "dictionary-license": ("wooorm/dictionaries/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/en/license", "2a7e8d8ae9e8facc84818546"),
}

# Each excerpt starts at an identified narrative paragraph and ends at a paragraph boundary.
BOOKS = [
    ("alice", "Alice's Adventures in Wonderland", "Lewis Carroll", 1865, "Сказка",
     "Alice-s-Adventures-in-Wonderland_11", "Alice was beginning", "0f9ea0b148d553177962a25e"),
    ("oz", "The Wonderful Wizard of Oz", "L. Frank Baum", 1900, "Сказка",
     "The-Wonderful-Wizard-of-Oz_55", "Dorothy lived in the midst", "18274f31ae11aea07ea9b4f7"),
    ("sherlock", "The Adventures of Sherlock Holmes", "Arthur Conan Doyle", 1892, "Детектив",
     "The-Adventures-of-Sherlock-Holmes_1661", "To Sherlock Holmes she is always", "2a0ce5568625a304f54fbb6b"),
    ("treasure", "Treasure Island", "Robert Louis Stevenson", 1883, "Приключения",
     "Treasure-Island_120", "SQUIRE TRELAWNEY, Dr. Livesey", "6c37a18a886b4c12eaf4e5ff"),
    ("pride", "Pride and Prejudice", "Jane Austen", 1813, "Роман",
     "Pride-and-Prejudice_1342", "It is a truth universally", "441e778a4297bfc944dc2548"),
    ("time", "The Time Machine", "H. G. Wells", 1895, "Фантастика",
     "The-Time-Machine_35", "The Time Traveller (for so", "e2a41e811f74fba738384f6f"),
    ("little-women", "Little Women", "Louisa May Alcott", 1868, "Роман",
     "Little-Women_514", '"Christmas won\'t be Christmas', "b20d98130841548c2137476e"),
    ("wild", "The Call of the Wild", "Jack London", 1903, "Приключения",
     "The-Call-of-the-Wild_215", "Buck did not read", "58df9556f1f2a05e9e227f7f"),
    ("garden", "The Secret Garden", "Frances Hodgson Burnett", 1911, "Роман",
     "The-Secret-Garden_17396", "When Mary Lennox was sent", "395cad3138858fbb60933092"),
    ("willows", "The Wind in the Willows", "Kenneth Grahame", 1908, "Сказка",
     "The-Wind-in-the-Willows_289", "The Mole had been working", "04794195e8a2cff4f17166a4"),
    ("moby", "Moby-Dick", "Herman Melville", 1851, "Приключения",
     "Moby-Dick--Or-The-Whale_2701", "Call me Ishmael.", "f17ab08e0ad8c6e43d1e85e3"),
    ("beauty", "Black Beauty", "Anna Sewell", 1877, "Роман",
     "Black-Beauty_271", "The first place that I can well remember", "42278e0a14b41855098ccd94"),
    ("brother", "A Kind Brother", "William Holmes McGuffey", 1879, "Учебный рассказ",
     "McGuffey-s-Second-Eclectic-Reader_14668", "1. A boy was once sent", "6849f2a0b52d31b639f0c68c"),
    ("mice", "The Mice in Council", "Aesop", 1867, "Басня",
     "Aesop-s-Fables--13-Translated-by-George-Fyler-Townsend_21", "THE MICE summoned a council", "09e745031fffd54d4f8ebead"),
]
END_HEADINGS = {"brother": "LESSON XVII.", "mice": "The Wolf and the Housedog"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, help="Optional directory for reusable source files")
    parser.add_argument("--check", action="store_true", help="Compare generated data against tracked files")
    args = parser.parse_args()
    if args.cache:
        args.cache.mkdir(parents=True, exist_ok=True)

    def fetch(key, path, checksum):
        cached = args.cache / (key + ".txt") if args.cache else None
        if cached and cached.exists():
            blob = cached.read_bytes()
        else:
            with urllib.request.urlopen(RAW + path, timeout=40) as response:
                blob = response.read()
            if cached:
                cached.write_bytes(blob)
        if not hashlib.sha256(blob).hexdigest().startswith(checksum):
            raise ValueError(f"Source checksum changed: {path}")
        return blob.decode("utf-8-sig").replace("\r\n", "\n")

    def save(path, body):
        target = ROOT / "data" / path
        if args.check:
            if target.read_text(encoding="utf-8") != body:
                raise ValueError(f"Out of date: {target}")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(body, encoding="utf-8", newline="\n")

    def save_json(path, obj):
        save(path, json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")

    def book(item):
        identifier, title, author, year, genre, slug, anchor, digest = item
        pg = slug.split("_")[-1]
        content = fetch(pg, f"GITenberg/{slug}/master/{pg}.txt", digest)
        paragraphs = [" ".join(p.split()).replace("_", "") for p in re.split(r"\n\s*\n", content) if p.strip()]
        start = next(i for i, p in enumerate(paragraphs) if p.startswith(anchor))
        section = []
        length = 0
        for p in paragraphs[start:]:
            if p == END_HEADINGS.get(identifier):
                break
            if identifier == "brother":
                p = re.sub(r"^[1-8]\. ", "", p)
            if section and re.match(r"^(?:chapter\s+\w+\b|\d+\.?\s+\w+|\[Illustration)", p, re.I):
                break
            section.append(p)
            length += len(p.split())
            if length >= 1150:
                break
        minimum = 80 if identifier in END_HEADINGS else 500
        if not minimum <= length < 1800:
            raise ValueError(f"Unexpected excerpt length for {identifier}: {length}")
        return dict(id=identifier, title=title, author=author, year=year, genre=genre, kind="txt",
                    source=f"https://www.gutenberg.org/ebooks/{pg}", text="\n\n".join(section))

    with ThreadPoolExecutor(max_workers=6) as pool:
        texts = list(pool.map(book, BOOKS))
        sources = dict(zip(LEXICONS, pool.map(lambda key: fetch(key, *LEXICONS[key]), LEXICONS)))
    save_json("demo/library.json", texts)
    pg = fetch("11", "GITenberg/Alice-s-Adventures-in-Wonderland_11/master/11.txt", BOOKS[0][-1])
    save("demo/LICENSE-GUTENBERG.txt", pg[pg.index("THE FULL PROJECT GUTENBERG LICENSE"):])

    forms = {}
    for line in sources["forms"].splitlines():
        lemma, form = line.split("\t")
        if re.fullmatch("[a-z]+", lemma) and re.fullmatch("[a-z]+", form):
            forms.setdefault(form, lemma)
    save_json("en/forms.json", "\n".join(f"{form} {lemma}" for form, lemma in sorted(forms.items())))

    dictionary = [line.split("/")[0] for line in sources["dictionary"].splitlines()[1:]]
    save_json("en/dictionary.json", " ".join(sorted({w for w in dictionary if re.fullmatch("[a-z]+", w)})))
    save("en/LICENSE-SCOWL.txt", sources["dictionary-license"])

    # Keep the source counts separate from morphology. Runtime ranking groups counts by lemma.
    counts = [line for line in sources["frequency"].splitlines() if re.fullmatch(r"[a-z]+ [1-9][0-9]*", line)]
    save_json("en/frequency.json", "\n".join(counts))
    print(f"{len(texts)} excerpts, {len(forms)} forms, {len(counts)} frequency entries")


if __name__ == "__main__":
    main()
