# VETER Core 0.1 — research prototype

VETER Core is a small decoder-only Transformer experiment. Its weights start from random initialization; it does not wrap an existing chat model. This is a learning prototype, not a production assistant or a ChatGPT competitor.

Included: a byte-level BPE tokenizer trained on your permitted text, causal self-attention Transformer, next-token pretraining, GPU mixed precision, checkpoints, and a basic generation script.

Default model: 6 layers, width 256, 4 attention heads, 8,000-token vocabulary. Default training context is 256 tokens. This is intentionally small; useful quality requires much more clean data, compute, evaluation, and engineering.

## Run

Use Python 3.10+. Install a PyTorch build suitable for your CPU or CUDA setup, then run from this directory:

    pip install -r requirements.txt
    python tokenizer_train.py --data data --out artifacts/tokenizer.json --vocab-size 8000
    python train.py --data data --tokenizer artifacts/tokenizer.json --steps 5000
    python sample.py --checkpoint artifacts/checkpoints/veter-core-step-5000.pt --prompt "Hello"

Resume:

    python train.py --resume artifacts/checkpoints/veter-core-step-5000.pt --data data --tokenizer artifacts/tokenizer.json

Keep the same tokenizer and model settings when resuming. The script saves checkpoints every 500 steps.

## Responsible data and limits

1. Add licensed .txt material under data. No training dataset is bundled.
2. Keep held-out validation and test material separate.
3. Record dataset provenance and licenses. Do not train on private data or copyrighted content without permission.
4. Free GPU sessions can disconnect and are not guaranteed. Save checkpoints elsewhere.
5. Do not claim VETER is trained until an actual run completes and is evaluated.
6. Before serious use, add a proper train/validation split, learning-rate schedule, tokenizer special-token handling, tests, and dataset provenance manifest.

Start with a tiny smoke test on CPU or an available free GPU. This code does not purchase or configure paid compute.
