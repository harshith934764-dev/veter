import torch
from torch import nn
from torch.nn import functional as F
from config import VETERConfig

class CausalSelfAttention(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        assert cfg.d_model % cfg.n_heads == 0
        self.heads = cfg.n_heads
        self.dim = cfg.d_model // cfg.n_heads
        self.qkv = nn.Linear(cfg.d_model, 3 * cfg.d_model, bias=cfg.bias)
        self.proj = nn.Linear(cfg.d_model, cfg.d_model, bias=cfg.bias)
        self.drop = nn.Dropout(cfg.dropout)

    def forward(self, x):
        b, t, c = x.shape
        q, k, v = self.qkv(x).split(c, dim=-1)
        shape = (b, t, self.heads, self.dim)
        q, k, v = [z.view(shape).transpose(1, 2) for z in (q, k, v)]
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        y = y.transpose(1, 2).contiguous().view(b, t, c)
        return self.drop(self.proj(y))

class Block(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.ln1 = nn.LayerNorm(cfg.d_model)
        self.attn = CausalSelfAttention(cfg)
        self.ln2 = nn.LayerNorm(cfg.d_model)
        self.mlp = nn.Sequential(nn.Linear(cfg.d_model, 4*cfg.d_model), nn.GELU(),
                                 nn.Linear(4*cfg.d_model, cfg.d_model), nn.Dropout(cfg.dropout))
    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        return x + self.mlp(self.ln2(x))

class VETERCore(nn.Module):
    def __init__(self, cfg: VETERConfig):
        super().__init__()
        self.cfg = cfg
        self.token = nn.Embedding(cfg.vocab_size, cfg.d_model)
        self.position = nn.Embedding(cfg.max_seq_len, cfg.d_model)
        self.drop = nn.Dropout(cfg.dropout)
        self.blocks = nn.Sequential(*[Block(cfg) for _ in range(cfg.n_layers)])
        self.norm = nn.LayerNorm(cfg.d_model)
        self.head = nn.Linear(cfg.d_model, cfg.vocab_size, bias=False)
        self.head.weight = self.token.weight
        self.apply(self._init)

    @staticmethod
    def _init(m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)
            if isinstance(m, nn.Linear) and m.bias is not None:
                nn.init.zeros_(m.bias)

    def forward(self, input_ids, targets=None):
        b, t = input_ids.shape
        if t > self.cfg.max_seq_len:
            raise ValueError("Input exceeds configured context length")
        pos = torch.arange(t, device=input_ids.device)
        x = self.drop(self.token(input_ids) + self.position(pos)[None, :, :])
        logits = self.head(self.norm(self.blocks(x)))
        loss = None if targets is None else F.cross_entropy(
            logits.reshape(-1, logits.size(-1)), targets.reshape(-1), ignore_index=-100)
        return logits, loss

    @torch.no_grad()
    def generate(self, ids, max_new_tokens=100, temperature=0.8, top_k=40):
        self.eval()
        for _ in range(max_new_tokens):
            logits, _ = self(ids[:, -self.cfg.max_seq_len:])
            logits = logits[:, -1] / max(temperature, 1e-5)
            if top_k:
                values, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < values[:, [-1]]] = -float("inf")
            ids = torch.cat((ids, torch.multinomial(F.softmax(logits, -1), 1)), dim=1)
        return ids
