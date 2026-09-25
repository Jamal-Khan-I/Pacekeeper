"""
Script to generate sample answer sheets for Class A (Mathematics), Class B (Physics), Class C (Chemistry),
plus unrelated non-academic images to prove model vision/OCR differentiation.
"""

import os
from PIL import Image, ImageDraw, ImageFont

DEMO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(DEMO_DIR, exist_ok=True)

def create_sheet(filename, header, student, items, bg_color="#FFFFFF", ruled=True):
    width, height = 900, 750
    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Draw header band
    draw.rectangle([(0, 0), (width, 80)], fill="#F1F5F9")
    draw.line([(0, 80), (width, 80)], fill="#CBD5E1", width=2)

    # Title & metadata
    draw.text((30, 15), header, fill="#0F172A")
    draw.text((30, 48), f"Student: {student}    |   Date: 2026-09-25   |   Exam Paper", fill="#475569")

    # Ruled lines
    if ruled:
        for y in range(120, height - 30, 32):
            draw.line([(30, y), (width - 30, y)], fill="#E2E8F0", width=1)
        # Margin line
        draw.line([(90, 80), (90, height)], fill="#FCA5A5", width=1)

    # Draw content items
    y_cursor = 110
    for q_num, prompt, student_ans, status, teacher_mark in items:
        # Question Prompt
        draw.text((105, y_cursor), f"Q{q_num}: {prompt}", fill="#1E293B")
        y_cursor += 28

        # Student Answer
        draw.text((120, y_cursor), f"Answer: {student_ans}", fill="#0369A1" if status == "correct" else "#B91C1C")
        
        # Teacher Annotation / Score
        draw.text((650, y_cursor), f"[{teacher_mark}]", fill="#15803D" if status == "correct" else "#DC2626")
        y_cursor += 42

    filepath = os.path.join(DEMO_DIR, filename)
    img.save(filepath, format="JPEG", quality=95)
    print(f"Generated: {filepath}")
    return filepath

# ----------------- CLASS A: MATHEMATICS -----------------
create_sheet(
    "class_a_math_calculus_chain_rule_error.jpg",
    "CLASS 11-A : ADVANCED CALCULUS & DERIVATIVES",
    "Alex Mercer",
    [
        (1, "Differentiate f(x) = sin(x^2). (MCQ)", "cos(x^2) * 2x", "correct", "Correct (+2)"),
        (2, "Find derivative of g(x) = (3x^2 - 5)^4 using Chain Rule. (Derivation)", "4(3x^2 - 5)^3 * (3x) = 12x(3x^2 - 5)^3 [Forgot derivative of 3x^2 is 6x!]", "incorrect", "Step 2 Error (-4)"),
        (3, "Evaluate limit x->0 of (sin x)/x. (Calculation)", "1 (by standard trigonometric limit)", "correct", "Correct (+2)"),
        (4, "Find tangent line slope for y = x^3 at x = 2. (Derivation)", "dy/dx = 3x^2 -> slope = 3(4) = 12", "correct", "Correct (+2)")
    ]
)

create_sheet(
    "class_a_math_integration_perfect_100.jpg",
    "CLASS 11-A : INTEGRAL CALCULUS MASTERY",
    "Elena Rostova",
    [
        (1, "Integral of (3x^2 + 2x + 1) dx. (Calculation)", "x^3 + x^2 + x + C", "correct", "Perfect (+3)"),
        (2, "Derive area under curve y = x^2 from 0 to 3. (Derivation)", "Int[0->3] x^2 dx = [x^3 / 3] = 27/3 - 0 = 9 units^2", "correct", "Full Steps (+4)"),
        (3, "Integration by parts of x * e^x dx. (Derivation)", "u=x, dv=e^x dx -> x*e^x - Int[e^x dx] = x*e^x - e^x + C", "correct", "Accurate (+3)")
    ]
)

create_sheet(
    "class_a_math_trig_mcq_errors.jpg",
    "CLASS 11-A : TRIGONOMETRY & VECTORS",
    "Marcus Vance",
    [
        (1, "Identify identity: cos^2(theta) + sin^2(theta) = ? (MCQ)", "Option B: 0 [Wrong, identity is 1]", "incorrect", "MCQ Error (-2)"),
        (2, "Double angle formula for sin(2 theta)? (MCQ)", "Option C: cos^2 - sin^2 [Wrong, that is cos 2theta]", "incorrect", "MCQ Error (-2)"),
        (3, "Vector cross product A=(1,0,0) x B=(0,1,0). (Derivation)", "Det method -> (0, 0, 1) = k_hat vector", "correct", "Correct (+4)")
    ]
)

create_sheet(
    "class_a_math_limits_lhopital_error.jpg",
    "CLASS 11-A : LIMITS & CONTINUITY",
    "Sarah Jenkins",
    [
        (1, "Evaluate lim x->1 of (x^2 - 1)/(x - 1). (Calculation)", "Factor: (x-1)(x+1)/(x-1) = x+1 = 2", "correct", "Correct (+3)"),
        (2, "Evaluate lim x->0 of (cos x)/(x + 1). (Derivation)", "Applied L'Hopital: -sin(x)/1 = 0 [WRONG: Not 0/0 indeterminate form! cos(0)/(0+1) = 1/1 = 1]", "incorrect", "Method Invalid (-5)")
    ]
)

create_sheet(
    "class_a_math_algebra_vectors_derivation_flaw.jpg",
    "CLASS 11-A : LINEAR ALGEBRA & MATRICES",
    "Devon Miles",
    [
        (1, "Matrix multiplication dimension rule. (MCQ)", "Columns of A must equal Rows of B", "correct", "Correct (+2)"),
        (2, "Derive 2x2 Matrix Inverse for [[1, 2], [3, 4]]. (Derivation)", "det = 4 - 6 = -2. adj = [[4, -2], [-3, 1]]. Inv = -1/2 * adj. Arithmetic error on row 2 sign.", "incorrect", "Sign Error (-3)"),
        (3, "Find eigenvalues of [[2, 0], [0, 5]]. (Calculation)", "Diagonal matrix -> lambda1 = 2, lambda2 = 5", "correct", "Correct (+3)")
    ]
)

# ----------------- CLASS B: PHYSICS -----------------
create_sheet(
    "class_b_physics_thermo_derivation_flaw.jpg",
    "CLASS 12-B : THERMODYNAMICS & HEAT ENGINES",
    "Brian Cox Jr.",
    [
        (1, "State First Law of Thermodynamics. (MCQ)", "Delta U = Q - W (Energy Conservation)", "correct", "Correct (+2)"),
        (2, "Derive Carnot Engine efficiency with Th=600K, Tc=300K. (Derivation)", "eta = 1 - (Tc/Th) = 1 - (300/600) = 0.50 (50%)", "correct", "Correct (+4)"),
        (3, "Isothermal expansion of 1 mole ideal gas at 300K. Find Delta U. (Derivation)", "Student wrote: Delta U = n*Cv*Delta T = 50 J. [WRONG: For isothermal Delta T=0, so Delta U = 0!]", "incorrect", "Conceptual Error (-4)")
    ]
)

create_sheet(
    "class_b_physics_optics_snell_law_correct.jpg",
    "CLASS 12-B : GEOMETRIC & WAVE OPTICS",
    "Chloe Bennet",
    [
        (1, "Calculate critical angle for glass (n=1.5) to air (n=1.0). (Calculation)", "sin(theta_c) = 1/1.5 = 0.667 -> theta_c = 41.8 deg", "correct", "Correct (+3)"),
        (2, "Derive Snell's Law from Fermat's Principle of least time. (Derivation)", "t = d1/v1 + d2/v2 -> dt/dx = 0 -> sin(theta1)/v1 = sin(theta2)/v2 -> n1*sin(1) = n2*sin(2)", "correct", "Flawless Derivation (+5)")
    ]
)

create_sheet(
    "class_b_physics_em_faraday_mcq_errors.jpg",
    "CLASS 12-B : ELECTROMAGNETISM & INDUCTION",
    "Samir Patel",
    [
        (1, "What does Lenz's Law describe? (MCQ)", "Option A: Magnitude of current [Wrong: Direction opposing flux change]", "incorrect", "MCQ Error (-2)"),
        (2, "SI unit of magnetic flux. (MCQ)", "Option D: Tesla [Wrong: Weber]", "incorrect", "MCQ Error (-2)"),
        (3, "Derive induced EMF in a rotating coil of area A in B field. (Derivation)", "Phi = B*A*cos(omega*t) -> EMF = -dPhi/dt = B*A*omega*sin(omega*t)", "correct", "Full Marks (+5)")
    ]
)

create_sheet(
    "class_b_physics_quantum_photoelectric_error.jpg",
    "CLASS 12-B : QUANTUM MECHANICS & PHOTOELECTRIC EFFECT",
    "Liam Gallagher",
    [
        (1, "Einstein's Photoelectric equation: E_photon = ? (Calculation)", "hf = Phi + K_max", "correct", "Correct (+2)"),
        (2, "Calculate stopping potential for incident lambda=200nm, work function=2.2eV. (Derivation)", "hf = 1240/200 = 6.2eV. K_max = 6.2 - 2.2 = 4.0eV. Student wrote V_stop = 400 Volts [Arithmetic blunder! 4.0 V]", "incorrect", "Unit Magnitude Error (-4)")
    ]
)

create_sheet(
    "class_b_physics_circuits_kirchhoff_loop_error.jpg",
    "CLASS 12-B : ELECTRIC CIRCUITS & NETWORK LAWS",
    "Zack Snyder",
    [
        (1, "Kirchhoff Current Law (KCL) is based on conservation of: (MCQ)", "Electric Charge", "correct", "Correct (+2)"),
        (2, "Write loop equation for clockwise 12V battery, R1=4ohm, R2=2ohm. (Derivation)", "12 - 4*I + 2*I = 0 [Sign error on R2 voltage drop! Should be -2*I]", "incorrect", "Sign Error (-3)"),
        (3, "Find total resistance of two 6 ohm resistors in parallel. (Calculation)", "1/R = 1/6 + 1/6 = 2/6 -> R = 3 ohms", "correct", "Correct (+2)")
    ]
)

# ----------------- CLASS C: CHEMISTRY -----------------
create_sheet(
    "class_c_chem_organic_reaction_mechanism_error.jpg",
    "CLASS 10-C : ORGANIC CHEMISTRY & MECHANISMS",
    "Natalie Portman",
    [
        (1, "Nucleophilic substitution: SN2 mechanism proceeds via: (MCQ)", "Option B: Two-step with carbocation [WRONG: Concerted backside attack]", "incorrect", "MCQ Concept Error (-2)"),
        (2, "Draw mechanism for acid-catalyzed hydration of propene. (Derivation)", "Protonation forms secondary carbocation (Markovnikov rule). Water attacks, deprotonation gives propan-2-ol.", "correct", "Stepwise Mechanism (+5)"),
        (3, "Identify functional group in CH3-CO-CH3. (Identification)", "Ketone (Carbonyl group)", "correct", "Correct (+2)")
    ]
)

create_sheet(
    "class_c_chem_electrochem_nernst_perfect_100.jpg",
    "CLASS 10-C : ELECTROCHEMISTRY & REDOX",
    "Tariq Al-Mansoor",
    [
        (1, "Standard Hydrogen Electrode (SHE) potential. (MCQ)", "0.00 Volts by convention", "correct", "Correct (+2)"),
        (2, "Write Nernst Equation for Zn/Cu Galvanic Cell at 298K. (Derivation)", "E_cell = E0_cell - (0.0592/2) * log([Zn2+]/[Cu2+])", "correct", "Correct Form (+4)"),
        (3, "Calculate cell EMF for standard Zn-Cu cell (E0_Cu=0.34V, E0_Zn=-0.76V). (Calculation)", "E0 = 0.34 - (-0.76) = +1.10 Volts", "correct", "Accurate (+3)")
    ]
)

create_sheet(
    "class_c_chem_kinetics_rate_law_derivation_error.jpg",
    "CLASS 10-C : CHEMICAL KINETICS & RATE LAWS",
    "Hannah Abbott",
    [
        (1, "Units of rate constant k for a 1st order reaction. (MCQ)", "s^-1 (per second)", "correct", "Correct (+2)"),
        (2, "Derive integrated rate law for 1st order decomposition A -> Products. (Derivation)", "ln[A] - ln[A0] = -kt. Student inverted log sign: ln([A0]/[A]) = -kt [WRONG algebraic sign]", "incorrect", "Derivation Sign Error (-4)"),
        (3, "Half-life formula for first order reaction. (Formula)", "t_1/2 = 0.693 / k", "correct", "Correct (+2)")
    ]
)

# ----------------- UNRELATED NON-ACADEMIC IMAGE (TO PROVE PART A) -----------------
def create_unrelated_image(filename):
    width, height = 800, 600
    img = Image.new("RGB", (width, height), color="#1E293B")
    draw = ImageDraw.Draw(img)

    # Draw geometric shapes, landscape illustration
    # Sun
    draw.ellipse([(600, 80), (720, 200)], fill="#F59E0B", outline="#D97706", width=3)
    # Mountains
    draw.polygon([(50, 450), (250, 150), (450, 450)], fill="#334155")
    draw.polygon([(250, 450), (500, 200), (750, 450)], fill="#475569")
    draw.polygon([(200, 225), (250, 150), (300, 225)], fill="#F8FAFC") # Snow cap
    # Foreground lake
    draw.rectangle([(0, 450), (width, height)], fill="#0284C7")
    draw.text((40, 520), "PHOTO: Mountain Sunrise & Forest Lake Landscape - Wallpaper Art", fill="#FFFFFF")
    draw.text((40, 550), "Camera: Sony A7R IV | Lens: 24-70mm f/2.8 GM | ISO 100", fill="#BAE6FD")

    filepath = os.path.join(DEMO_DIR, filename)
    img.save(filepath, format="JPEG", quality=95)
    print(f"Generated unrelated photo: {filepath}")
    return filepath

create_unrelated_image("unrelated_photo_landscape.jpg")

print("All sample dataset files generated successfully in demo_data/!")
