"""Download a small public story dataset and launch a first VETER training experiment.

This is a proof-of-pipeline experiment, not assistant training. Review the dataset
card/license before use. Run on a free GPU notebook with the repository checked out.
"""
import argparse
from pathlib import Path
from datasets import load_dataset
import subprocess
import sys

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--rows", type=int, default=10000)
    p.add_argument("--steps", type=int, default=2000)
    p.add_argument("--batch-size", type=int, default=8)
    a = p.parse_args()
    print("Loading TinyStories subset. Check its Hugging Face dataset card and license before training.")
    ds = load_dataset("roneneldan/TinyStories", split=f"train[:{a.rows}]")
    data = Path("data/first_experiment")
    data.mkdir(parents=True, exist_ok=True)
    out = data / "tinystories_sample.txt"
    with out.open("w", encoding="utf-8") as f:
        for row in ds:
            text = row.get("text", "")
            if text and text.strip():
                f.write(text.strip() + "\n\n")
    print(f"Saved {len(ds)} examples to {out}")
    subprocess.run([sys.executable, "tokenizer_train.py", "--data", str(data),
                    "--out", "artifacts/tokenizer.json", "--vocab-size", "8000"], check=True)
    subprocess.run([sys.executable, "train.py", "--data", str(data),
                    "--tokenizer", "artifacts/tokenizer.json", "--steps", str(a.steps),
                    "--batch-size", str(a.batch_size), "--seq-len", "256"], check=True)

if __name__ == "__main__":
    main()
