import argparse, random
from pathlib import Path
import torch
from tokenizers import Tokenizer
from config import VETERConfig
from model import VETERCore

def batches(tokens, batch, length, device):
    limit = len(tokens) - length - 1
    if limit <= 0:
        raise ValueError("Corpus is too small for this sequence length.")
    starts = torch.randint(0, limit, (batch,))
    x = torch.stack([tokens[i:i+length] for i in starts])
    y = torch.stack([tokens[i+1:i+length+1] for i in starts])
    return x.to(device), y.to(device)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data")
    p.add_argument("--tokenizer", default="artifacts/tokenizer.json")
    p.add_argument("--out", default="artifacts/checkpoints")
    p.add_argument("--steps", type=int, default=5000)
    p.add_argument("--batch-size", type=int, default=8)
    p.add_argument("--seq-len", type=int, default=256)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--resume", default="")
    a = p.parse_args()
    random.seed(a.seed); torch.manual_seed(a.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda": torch.cuda.manual_seed_all(a.seed)
    tok = Tokenizer.from_file(a.tokenizer)
    paths = sorted(Path(a.data).glob("**/*.txt"))
    if not paths: raise SystemExit("Add licensed .txt files under the data directory.")
    corpus = "\n".join(f.read_text(encoding="utf-8", errors="replace") for f in paths)
    ids = torch.tensor(tok.encode(corpus).ids, dtype=torch.long)
    if len(ids) < a.seq_len + 2: raise SystemExit("Not enough tokens in corpus.")
    cfg = VETERConfig(vocab_size=tok.get_vocab_size(), max_seq_len=a.seq_len)
    start = 0
    ckpt = None
    if a.resume:
        ckpt = torch.load(a.resume, map_location=device, weights_only=False)
        cfg = VETERConfig(**ckpt["config"])
    model = VETERCore(cfg).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=0.1)
    if ckpt:
        model.load_state_dict(ckpt["model"])
        opt.load_state_dict(ckpt["optimizer"])
        start = ckpt["step"]
    scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    print(f"Device={device}; tokens={len(ids):,}; parameters={sum(p.numel() for p in model.parameters()):,}")
    model.train()
    for step in range(start + 1, start + a.steps + 1):
        x, y = batches(ids, a.batch_size, cfg.max_seq_len, device)
        opt.zero_grad(set_to_none=True)
        with torch.autocast(device_type=device, dtype=torch.float16, enabled=device == "cuda"):
            _, loss = model(x, y)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt); scaler.update()
        if step % 50 == 0: print(f"step={step} loss={loss.item():.4f}")
        if step % 500 == 0 or step == start + a.steps:
            dest = out / f"veter-core-step-{step}.pt"
            torch.save({"step": step, "config": cfg.__dict__, "model": model.state_dict(),
                        "optimizer": opt.state_dict()}, dest)
            print(f"Checkpoint: {dest}")
    print("Run completed. Evaluate on held-out data before judging model quality.")

if __name__ == "__main__":
    main()
