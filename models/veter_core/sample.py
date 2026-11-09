import argparse, torch
from tokenizers import Tokenizer
from config import VETERConfig
from model import VETERCore

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--checkpoint", required=True)
    p.add_argument("--tokenizer", default="artifacts/tokenizer.json")
    p.add_argument("--prompt", default="Hello, I am VETER.")
    p.add_argument("--tokens", type=int, default=100)
    a = p.parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    ckpt = torch.load(a.checkpoint, map_location=device, weights_only=False)
    cfg = VETERConfig(**ckpt["config"])
    model = VETERCore(cfg).to(device); model.load_state_dict(ckpt["model"]); model.eval()
    tok = Tokenizer.from_file(a.tokenizer)
    ids = tok.encode(a.prompt).ids or [0]
    result = model.generate(torch.tensor([ids], device=device), a.tokens)
    print(tok.decode(result[0].tolist(), skip_special_tokens=True))

if __name__ == "__main__":
    main()
