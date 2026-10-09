"""Attention-capacity estimation error = |estimated - actual next session| (proposal metric)."""
from statistics import mean, median

def capacity_error(actual_minutes: list[int]) -> float:
    errs = [abs(median(actual_minutes[:i]) - actual_minutes[i]) for i in range(3, len(actual_minutes))]
    return mean(errs) if errs else 0.0

if __name__ == "__main__":
    print("MAE (minutes):", capacity_error([20, 25, 30, 22, 28, 35, 24, 26]))
