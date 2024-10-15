import numpy as np
from qiskit.circuit import QuantumCircuit
from qiskit_aer import StatevectorSimulator

def encode(bases, states):
    message = []
    for b,s in zip(bases,states):
        qc = QuantumCircuit(1,1)
        match b,s:
            case 0,0: pass
            case 0,1: qc.x(0)
            case 1,0: qc.h(0)
            case 1,1: qc.x(0), qc.h(0)
        message.append(qc)
    return message

def decode(msg: list[QuantumCircuit], bases):
    states = []
    for m,b in zip(msg,bases):
        backend = StatevectorSimulator()
        match m,b:
            case _,0: m.measure(0,0)
            case _,1: m.h(0), m.measure(0,0)
        states.append(int(backend.run(circuits=m, shots=1,memory=True)
                          .result()
                          .get_memory()[0]))
    return states

def env_init(n_bits: int, intercepted=False):
    num_qubits = n_bits

    alice_bases = np.random.randint(2, size=num_qubits)
    alice_bits = np.random.randint(2, size=num_qubits)
    bob_bases = np.random.randint(2, size=num_qubits)

    eve_bases = []
    if intercepted:
        eve_bases= np.random.randint(2, size=num_qubits)
    return alice_bits, alice_bases, bob_bases, eve_bases

def simulate_bb84(n_bits: int, alice_bits, alice_bases, bob_bases, eve_bases=[]):
    """return decoded message containing states in |0> or |1>"""
    msg = encode(alice_bases, alice_bits)
    # print(f"Alice's Encoded Message:\t {np.array2string(alice_encoded_key)}")

    if len(eve_bases):
        eve_eavesdrop = np.array(decode(msg, eve_bases))
        print(f"Eve's message: \t {np.array2string(eve_eavesdrop)}")

    #If basis is a Pauli matrix (invert = itself), the measured result will match if the basis is matched
    bob_key = np.array(decode(msg, bob_bases))
    print(f"Bob's message: \t {np.array2string(bob_key)}")

    return bob_key
def sample_bits(bits, selection):
    sample = []
    for i in selection:
        i = np.mod(i, len(bits))
        sample.append(bits[i])
    return sample

def remove_bargage(pubA, pubB, sec):
    good_bits = []
    for i in range(len(pubA)):
        if pubA[i] == pubB[i]:
            good_bits.append(sec[i])
    return good_bits

if __name__ == "__main__":

    # 011
    alice_bits = [0, 1, 1]
    alice_bases = [0,1,0]
    bob_bases = [1,1,0]
    eve_bases = [1,1,1]

    nbits = 32
    
    alice_bits, alice_bases,bob_bases,eve_bases = env_init(nbits,intercepted=False)
    print(f"Alice's basis: \t {np.array2string(alice_bases)}")
    print(f"Bob's basis: \t {np.array2string(bob_bases)}")
    if len(eve_bases):
        print(f"Eve's basis: \t {np.array2string(eve_bases)}")

    print(f"Alice's message: {np.array2string(alice_bits)}")
    bob_decoded = simulate_bb84(nbits, alice_bits, alice_bases, bob_bases,eve_bases=eve_bases)
    
    print("Remove bargage...")
    alice_key = remove_bargage(alice_bases, bob_bases, alice_bits)
    bob_key = remove_bargage(alice_bases, bob_bases, bob_decoded)
    print(f"Alice's key: \t{alice_key}")
    print(f"Bob's key:  \t{bob_key}")

    sample_size = 15
    bit_selection = np.random.randint(nbits, size=sample_size)
    bob_sample = sample_bits(bob_key, bit_selection)
    alice_sample = sample_bits(alice_key, bit_selection)

    print(f"Alice's sample:\t{alice_sample}")
    print(f"Bob's sample:  \t{bob_sample}")
    if bob_sample != alice_sample:
        print("Intercepted!")
    