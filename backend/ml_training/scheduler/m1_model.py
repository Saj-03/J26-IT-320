"""
Step 5 - M1 Focus Success Network (PyTorch).

    last 10 sessions --> GRU (32) --> "how it's going lately" ─┐
                                                              ├─> MLP (64 -> 32 -> 1) -> P(completed)
    new session + past summary (18 numbers) ─────────────────┘

GRU = a small recurrent network that reads sessions in order and remembers the trend.
MLP = normal fully-connected layers that mix the trend with the new situation.
"""
import torch
from torch import nn

from ml_training.scheduler.m1_features import CONTEXT_FEATURES, STEP_FEATURES


class FocusSuccessNet(nn.Module):
    def __init__(self, gru_size: int = 32, hidden: int = 64, dropout: float = 0.1):
        super().__init__()
        self.gru = nn.GRU(input_size=len(STEP_FEATURES), hidden_size=gru_size, batch_first=True)
        self.mlp = nn.Sequential(
            nn.Linear(gru_size + len(CONTEXT_FEATURES), hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, 32), nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, seq: torch.Tensor, ctx: torch.Tensor) -> torch.Tensor:
        """seq: (batch, 10, steps), ctx: (batch, 18) -> logits (batch,). Use sigmoid for a chance."""
        _, last = self.gru(seq)                  # last hidden state = summary of the 10 sessions
        return self.mlp(torch.cat([last[-1], ctx], dim=1)).squeeze(1)
