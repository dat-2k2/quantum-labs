import numpy as np
from simulator import H, KET_0, QuantumDevice, Qubit


def qrng() -> bool:
    return np.random.ranf() < np.abs(H @KET_0)

if __name__ == "__main__":
    qsim = Qubit()
    for idx_sample in range(10):
        random_sample = qrng(qsim)
        print(f"Our QRNG returned {random_sample}.")
