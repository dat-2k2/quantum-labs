from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel
from qiskit_aer.noise import pauli_error
import numpy as np
import matplotlib.pyplot as plt
from tqdm import tqdm
from collections import defaultdict

def create_shor_circuit(error_location):
    """
    Create Shor's 9-qubit code circuit with noise channel on specified qubit
    error_location: which qubit to apply the noise channel (0-8)
    """
    q = QuantumRegister(9, 'q')
    c = ClassicalRegister(9, 'c')
    qc = QuantumCircuit(q, c)
    
    # Initialize to |1⟩ state
    qc.x(0)
    
    # Encoding part
    qc.cx(0, 3)
    qc.cx(0, 6)
    
    for i in [0, 3, 6]:
        qc.h(i)
        qc.cx(i, i+1)
        qc.cx(i, i+2)
    
    # Add identity gate only to the specified qubit
    qc.id(error_location)
    
    # Decoding part
    for i in [0, 3, 6]:
        qc.cx(i, i+1)
        qc.cx(i, i+2)
        qc.h(i)
    
    qc.cx(0, 3)
    qc.cx(0, 6)
    
    qc.measure_all()
    qc.draw('mpl',filename='circuit.png')
    return qc

def create_pauli_noise_model(p_x, p_y, p_z):
    """Create noise model for single-qubit Pauli errors"""
    noise_model = NoiseModel()
    
    error_ops = [
        ('X', p_x),
        ('Y', p_y),
        ('Z', p_z),
        ('I', 1 - (p_x + p_y + p_z))
    ]
    
    pauli_noise = pauli_error(error_ops)
    noise_model.add_all_qubit_quantum_error(pauli_noise, ['id'])
    
    return noise_model

def run_with_single_qubit_noise(p_total, shots=1024, error_ratio=(1, 1, 1)):
    """
    Run Shor's code with noise on each qubit location and average results
    """
    # Normalize error ratios
    total_ratio = sum(error_ratio)
    rx, ry, rz = [r/total_ratio for r in error_ratio]
    
    p_x = p_total * rx
    p_y = p_total * ry
    p_z = p_total * rz
    
    noise_model = create_pauli_noise_model(p_x, p_y, p_z)
    backend = AerSimulator(noise_model=noise_model)
    
    total_error_rate = 0
    # Test each qubit location
    for error_location in range(9):
        qc = create_shor_circuit(error_location)
        result = backend.run(qc, shots=shots).result()
        counts = result.get_counts()
        
        # Calculate error rate for this location
        logical_counts = defaultdict(int)
        for bitstring, count in counts.items():
            logical_value = bitstring[0]
            logical_counts[logical_value] += count
        
        error_rate = logical_counts['0'] / shots
        total_error_rate += error_rate
    
    # Return average error rate across all locations
    return total_error_rate / 9

def analyze_pauli_noise(noise_range=(0, 0.5), num_points=20, shots=1024, error_ratio=(1, 1, 1)):
    """Analyze circuit performance with Pauli noise"""
    noise_probs = np.linspace(noise_range[0], noise_range[1], num_points)
    error_probs = []
    
    for p in tqdm(noise_probs, desc="Analyzing single-qubit Pauli errors"):
        error_prob = run_with_single_qubit_noise(p, shots, error_ratio)
        error_probs.append(error_prob)
    
    return noise_probs, error_probs

def plot_analysis():
    """Plot results for different types of Pauli errors"""
    # Test different error types
    noise_probs, error_probs_x = analyze_pauli_noise(error_ratio=(1, 0, 0))  # X errors only
    _, error_probs_z = analyze_pauli_noise(error_ratio=(0, 0, 1))  # Z errors only
    _, error_probs_both = analyze_pauli_noise(error_ratio=(1, 1, 1))  # Equal X,Y,Z errors
    
    plt.figure(figsize=(12, 8))
    
    plt.plot(noise_probs, error_probs_x, 'b.-', label='Bit-flip (X) Only', linewidth=2)
    plt.plot(noise_probs, error_probs_z, 'r.-', label='Phase-flip (Z) Only', linewidth=2)
    plt.plot(noise_probs, error_probs_both, 'g.-', label='Equal X,Y,Z Errors', linewidth=2)
    plt.plot(noise_probs, noise_probs, 'k--', label='No Correction', alpha=0.5)
    
    plt.xlabel('Single-Qubit Error Probability')
    plt.ylabel('Average Logical Error Probability')
    plt.title("Shor's 9-Qubit Code: Average Performance Against Single-Qubit Errors")
    plt.grid(True, alpha=0.3)
    plt.legend()
    
    return plt

def main():
    print("Analyzing Shor's code against single-qubit Pauli errors...")
    print("Testing each qubit location separately and averaging results...")
    plt = plot_analysis()
    plt.savefig('shor_single_bit_analysis.png', dpi=300, bbox_inches='tight')
    print("Analysis complete. Plot saved as 'shor_single_bit_analysis.png'")

if __name__ == "__main__":
    main()