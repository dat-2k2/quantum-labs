from contextlib import contextmanager
import numpy as np
# init a qubit with p0 = 1
KET_0 = np.array([
    [1],
    [0]
], dtype=complex)

KET_1 = np.array([
    [0],
    [1]
], dtype=complex)

BRA_0 = np.array([
    [1,0]
], dtype=complex)

BRA_1 = np.array([
    [0,1]
], dtype=complex)
# Hadarmard operator
H = np.array([
    [1, 1],
    [1, -1]
], dtype=complex) / np.sqrt(2)

# NOT gate
X = np.array([
    [0, 1],
    [1, 0]
], dtype=complex)


Z = np.array([
    [1, 0],
    [0, -1]
], dtype=complex)

I = np.array([
    [1, 0],
    [0, 1]
], dtype=complex)

class Qubit:

    def __init__(self):
        self.reset()

    def h(self):
        self.state = H @ self.state

    def x(self):
        self.state = X @ self.state

    # def cx(self, cond):
    #     if cond:
    #         self.state = 
    def measure(self) -> bool:
        pr0 = np.abs(self.state[0, 0]) ** 2
        sample = np.random.random() <= pr0
        return bool(0 if sample else 1)

    def reset(self):
        self.state = KET_0.copy()

class QuantumDevice:
    available_qubits = [Qubit()]

    def allocate_qubit(self) -> Qubit:
        if self.available_qubits:
            return self.available_qubits.pop()

    def deallocate_qubit(self, qubit: Qubit):
        self.available_qubits.append(qubit)

    @contextmanager
    def using_qubit(self):
        """Support allocate and release resources (with ... as ...)

        :yield: try to allocate a new qubit. If not succeed, remove the error qubit
        """
        qubit = self.allocate_qubit()
        try:
            yield qubit
        finally:
            qubit.reset()
            self.deallocate_qubit(qubit)

if __name__ == "__main__":
    print(Z@H@KET_0)
