import argparse
from pathlib import Path
from tokenizers import Tokenizer, models, trainers, pre_tokenizers, decoders

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data")
    p.add_argument("--out", default="artifacts/tokenizer.json")
    p.add_argument("--vocab-size", type=int, default=8000)
    a = p.parse_args()
    files = sorted(Path(a.data).glob("**/*.txt"))
    if not files:
        raise SystemExit("No .txt corpus files found.")
    tok = Tokenizer(models.BPE(unk_token="[UNK]"))
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()
    trainer = trainers.BpeTrainer(vocab_size=a.vocab_size, min_frequency=2,
        special_tokens=["[PAD]", "[UNK]", "[BOS]", "[EOS]"])
    tok.train([str(f) for f in files], trainer)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tok.save(str(out))
    print(f"Tokenizer saved: {out}; vocab={tok.get_vocab_size()}")

if __name__ == "__main__":
    main()
