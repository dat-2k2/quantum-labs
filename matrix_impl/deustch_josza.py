from matrix_impl.simulator import H, KET_0, X
import numpy as np
import functools

    
def deutsch_algorithm(n, f: list[bool]):
    # Create superposition state
    inputs = [KET_0 for _ in range(n+1)]
    inputs[-1] = X @ inputs[-1]
    
    Hs = functools.reduce(lambda x,y: np.kron(x, y), [H for _ in range(n+1)])
    inp = functools.reduce(lambda x,y: np.kron(x, y), inputs)

    out = Hs @ (U(n,f) @ (Hs @ inp))

    measure = out[0,0]*out[0,0] + out[1,0]*out[1,0]

    if measure < 1e-12: 
        print("The function is balanced.")
    elif 1.- measure < 1e-12:
        print("The function is constant.")
    else:
        print("The function is not balanced nor constant.")


def U(n, f: list[bool]):
    assert len(f) == 2**n

    num_qubits = n + 1
    U = np.zeros((2**num_qubits, 2**num_qubits)) 

    for x_y in range(2**num_qubits): 
        x = x_y >> 1 # x
        y_xor_fx = (x_y & 1) ^ (f[x]) # y ^ f(x)
        x_y_xor_fx = (x << 1) + y_xor_fx # x , y^f(x)
        U[x_y, x_y_xor_fx] = 1

    return U


if __name__ ==  "__main__":
    n = [2,3,3]  # Input the number of qubits
    f_map = [[0,0,1,1],
             [1,1,1,1,1,1,1,1],
             [1,0,0,1,1,0,1,1]]  # Input the mapping functions

    for index, value in enumerate(n):
        deutsch_algorithm(n[index], f_map[index])  # Algorithm executed here