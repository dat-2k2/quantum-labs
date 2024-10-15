import numpy as np
from simulator import H, KET_0

def qrng() -> bool:
    return not np.random.ranf() < np.abs((H @ KET_0)[0,0])**2

if __name__ == "__main__":
    for idx_sample in range(10):
        random_sample = qrng()
        print(f"Our QRNG returned {random_sample}.")
