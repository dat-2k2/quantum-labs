import numpy as np
from simulator import H, KET_0

def qrng(n):
    return int(f"0b{''.join(['0' 
        if np.random.ranf() < np.abs((H @ KET_0)[0,0])**2 
        else '1' 
        for _ in range(n)])}",base=2)

if __name__ == "__main__":
    for idx_sample in range(10):
        random_sample = qrng(5)
        print(f"Our QRNG returned {random_sample}.")
