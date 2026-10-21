"""
M4 data - download the English part of Amazon MASSIVE (CC BY 4.0, built from SLURP).

MASSIVE = 1M virtual-assistant utterances in 52 locales with intents and slot labels
([time : five am], [date : friday]). There is NO Sinhala locale, so the Sinhala / Singlish part of the
M4 dataset is made by us (templates + translation) and tested on real sentences written by students.

We keep only en-US (calendar / alarm / lists etc. are inside it). The data is git-ignored
(data/external/), so every team member runs this once.

Run (from backend/):  python -m ml_training.scheduler.fetch_massive
Out:                  ml_training/scheduler/data/external/massive/1.1/data/en-US.jsonl (+ NOTICE.md, CITATION.md)

Citation: FitzGerald et al., "MASSIVE: A 1M-Example Multilingual Natural Language Understanding Dataset
with 51 Typologically-Diverse Languages", ACL 2023.
"""
import tarfile
import urllib.request
from pathlib import Path

URL = "https://amazon-massive-nlu-dataset.s3.amazonaws.com/amazon-massive-dataset-1.1.tar.gz"
OUT = Path(__file__).resolve().parent / "data" / "external" / "massive"
KEEP = ("1.1/data/en-US.jsonl", "1.1/NOTICE.md", "1.1/CITATION.md")


def main() -> None:
    target = OUT / "1.1" / "data" / "en-US.jsonl"
    if target.exists():
        print(f"already downloaded: {target}")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    archive = OUT / "massive-1.1.tar.gz"
    print(f"downloading {URL} (~40 MB) ...")
    urllib.request.urlretrieve(URL, archive)
    with tarfile.open(archive) as tar:
        for name in KEEP:                                   # only the files we need, nothing else
            tar.extract(tar.getmember(name), OUT, filter="data")
    archive.unlink()
    lines = sum(1 for _ in target.open(encoding="utf-8"))
    print(f"saved {lines} English utterances -> {target}")


if __name__ == "__main__":
    main()
