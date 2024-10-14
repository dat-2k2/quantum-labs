import functools

import numpy as np
from simulator import BRA_0, BRA_1, I, KET_0, KET_1, X


def toffoli(n):
    KETBRA_1 = KET_1 @ BRA_1
    KETBRA_0 = KET_0 @ BRA_0
    do_nothing = []
    for i in range(n-1):
        state = [I for _ in range(n)]
        state[i] = KETBRA_0
        do_nothing += [functools.reduce(lambda x,y: np.kron(x,y), state)]
    flip = [functools.reduce(lambda x,y: np.kron(x,y), [KETBRA_1 for _ in range(n-1)] + [X])]
    val = np.array(functools.reduce(lambda x,y: x+y, do_nothing+flip), dtype=int)
    print(val.shape)
    for i in range(val.shape[0]):
        for j in range(val.shape[1]):
            val[i,j] = 1 if val[i,j] > 0 else 0
    return val


def cnnot(n, pos: list[int]):
    assert all([i < n-1 for i in pos])
    KETBRA_1 = KET_1 @ BRA_1
    KETBRA_0 = KET_0 @ BRA_0

    do_nothing = []
    for i in pos:
        state = [I for _ in range(n)]
        state[i] = KETBRA_0
        do_nothing += [functools.reduce(lambda x,y: np.kron(x,y), state)]
    
    flip_state = [I for _ in range(n-1)] + [X]
    for i in pos:
        flip_state[i] = KETBRA_1
    flip = [functools.reduce(lambda x,y: np.kron(x,y), flip_state)]

    val = np.array(functools.reduce(lambda x,y: x+y, do_nothing+flip), dtype=int)

    for i in range(val.shape[0]):
        for j in range(val.shape[1]):
            val[i,j] = 1 if val[i,j] > 0 else 0

    return val