"""Generate the large-graph browser fixtures with the real runtime tracer."""
from pathlib import Path

import torch
from torch import nn

import p2i


class RepeatedOperations(nn.Module):
    def __init__(self, count):
        super().__init__()
        self.count = count

    def forward(self, x):
        for _ in range(self.count):
            x = x.relu()
        return x


def main():
    folder = Path(__file__).resolve().parents[1] / 'artifacts' / 'performance'
    folder.mkdir(parents=True, exist_ok=True)
    for count in (500, 1000, 3000):
        ir = p2i.trace(RepeatedOperations(count), (torch.ones(2, 8),), static=False)
        assert len(ir.operations) == count
        ir.save(folder / f'graph-{count}.json')


if __name__ == '__main__':
    main()
