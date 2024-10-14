from simulator import QuantumDevice, Qubit
from qrandom import qrng
from typing import List

def sample_random_bit(device: QuantumDevice) -> bool:
    return qrng(QuantumDevice())

def prepare_message_qubit(message: bool, basis: bool, q: Qubit) -> None:
    # Init: q - (1,0)
    if message:
        # q -> (0,1)
        q.x()
    # 01 -> +, 11 -> -. Create entanglement
    if basis:
        q.h()

def measure_message_qubit(basis: bool, q: Qubit) -> bool:
    if basis:
        q.h()
    result = q.measure()
    q.reset()
    return result

def convert_to_hex(bits: List[bool]) -> str:
    return hex(int(
        "".join(["1" if bit else "0" for bit in bits]),
        2
    ))

def send_single_bit_with_bb84(
    alice_device: QuantumDevice,
    bob_device: QuantumDevice,
    eve_device : QuantumDevice
    ) -> tuple:

    [alice_message, alice_basis] = [
        sample_random_bit(alice_device) for _ in range(2)
    ]

    bob_basis = sample_random_bit(bob_device)

    with alice_device.using_qubit() as q:
        prepare_message_qubit(alice_message, alice_basis, q)

        if eve_device:
            eve_basis = sample_random_bit(eve_device)
            eve_result = measure_message_qubit(eve_basis, q)
        
        # QUBIT SENDING...
        bob_result = measure_message_qubit(bob_basis, q)

    return ((alice_message, alice_basis), (bob_result, bob_basis))

def simulate_bb84(n_bits: int) -> list:
    alice_device = QuantumDevice()
    bob_device = QuantumDevice()
    eve_device = QuantumDevice()

    key = []
    n_rounds = 0

    while len(key) < n_bits:
        n_rounds += 1
        ((your_message, your_basis), (bob_result, bob_basis)) = \
            send_single_bit_with_bb84(alice_device, bob_device, eve_device)
# 
        if your_basis == bob_basis:
            assert your_message == bob_result
            key.append(your_message)

    print(f"Took {n_rounds} rounds to generate a {n_bits}-bit key.")

    return key

def apply_one_time_pad(message: List[bool], key: List[bool]) -> List[bool]:
    return [
        message_bit ^ key_bit
        for (message_bit, key_bit) in zip(message, key)
    ]

if __name__ == "__main__":
    print("Generating a 96-bit key by simulating BB84...")
    key = simulate_bb84(96)
    print(f"Alice got key                           {convert_to_hex(key)}.")

    message = [
        1, 1, 0, 1, 1, 0, 0, 0,
        0, 0, 1, 1, 1, 1, 0, 1,
        1, 1, 0, 1, 1, 1, 0, 0,
        1, 0, 0, 1, 0, 1, 1, 0,
        1, 1, 0, 1, 1, 0, 0, 0,
        0, 0, 1, 1, 1, 1, 0, 1,
        1, 1, 0, 1, 1, 1, 0, 0,
        0, 0, 0, 0, 1, 1, 0, 1,
        1, 1, 0, 1, 1, 0, 0, 0,
        0, 0, 1, 1, 1, 1, 0, 1,
        1, 1, 0, 1, 1, 1, 0, 0,
        1, 0, 1, 1, 1, 0, 1, 1
    ]
    
    print(f"Alice sends secret message: {convert_to_hex(message)}.")

    encrypted_message = apply_one_time_pad(message, key)
    print(f"Encrypted message:                {convert_to_hex(encrypted_message)}.")

    decrypted_message = apply_one_time_pad(encrypted_message, key)
    print(f"Bob decrypted to get:             {convert_to_hex(decrypted_message)}.")
    