from dataclasses import asdict, dataclass
import json
from pathlib import Path

@dataclass
class VETERConfig:
    vocab_size: int = 8000
    max_seq_len: int = 256
    d_model: int = 256
    n_heads: int = 4
    n_layers: int = 6
    dropout: float = 0.1
    bias: bool = True

    def save(self, path):
        Path(path).write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path):
        return cls(**json.loads(Path(path).read_text(encoding="utf-8")))
