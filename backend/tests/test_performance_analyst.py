"""
Standalone Test Script for Performance Analyst Agent with sample answer sheet image.
"""

import os
from PIL import Image, ImageDraw, ImageFont
from backend.app.agents.performance_analyst import performance_analyst_agent


def create_sample_answer_sheet_image(filepath: str):
    """Creates a sample photographed answer sheet image for testing vision diagnosis."""
    img = Image.new('RGB', (600, 800), color=(245, 243, 238))
    draw = ImageDraw.Draw(img)

    # Header
    draw.text((30, 30), "MID-TERM MATH EXAM - CALCULUS & DERIVATIVES", fill=(20, 20, 20))
    draw.text((30, 50), "Student: Alex R. | Date: Sept 2026", fill=(60, 60, 60))
    draw.line([(30, 75), (570, 75)], fill=(150, 150, 150), width=2)

    # Q1 MCQ
    draw.text((30, 90), "Q1 [MCQ]. Find d/dx (x^3 + 5x):", fill=(20, 20, 20))
    draw.text((50, 115), "Student Answer: (A) 3x^2 + 5", fill=(10, 80, 20))
    draw.text((450, 115), "[CORRECT +5]", fill=(0, 128, 0))

    # Q2 Long Derivation Proof
    draw.text((30, 160), "Q2 [DERIVATION]. Prove d/dx [sin(x^2)] = 2x cos(x^2):", fill=(20, 20, 20))
    draw.text((50, 185), "Student Work:", fill=(60, 60, 60))
    draw.text((50, 210), "Step 1: Let u = x^2 => du/dx = 2x", fill=(40, 40, 40))
    draw.text((50, 235), "Step 2: d/dx sin(u) = cos(u) * 1  <-- ERROR", fill=(180, 20, 20))
    draw.text((50, 260), "Result = cos(x^2)", fill=(180, 20, 20))
    draw.text((450, 260), "[WRONG -15]", fill=(200, 0, 0))

    # Q3 Integration
    draw.text((30, 310), "Q3 [INTEGRATION]. Evaluate integral of 2x dx:", fill=(20, 20, 20))
    draw.text((50, 335), "Student Answer: x^2 (Forgot +C constant)", fill=(180, 100, 20))
    draw.text((450, 335), "[PARTIAL +4/10]", fill=(180, 100, 0))

    # Red Teacher Markings
    draw.text((400, 400), "TOTAL SCORE: 35 / 100", fill=(220, 20, 20))
    draw.text((350, 430), "NEEDS URGENT REVISION!", fill=(220, 20, 20))

    img.save(filepath)
    print(f"Sample answer sheet image created at: {filepath}")


def test_performance_analyst_standalone():
    sample_img_path = os.path.join(os.path.dirname(__file__), "sample_answer_sheet.png")
    create_sample_answer_sheet_image(sample_img_path)

    print("\n--- Running Performance Analyst Agent on Sample Answer Sheet ---")
    diagnosis = performance_analyst_agent.analyze_answer_sheet(
        image_input=sample_img_path,
        topic_hint="Calculus & Derivatives",
        available_topics=[{"name": "Calculus Derivatives", "subject": "Mathematics"}]
    )

    print("\n=== PERFORMANCE ANALYST AGENT DIAGNOSIS RESULT ===")
    print(f"Overall Score: {diagnosis.overall_score * 100:.1f}%")
    print(f"Detected Topic: {diagnosis.detected_topic}")
    print(f"Weak Question Types: {diagnosis.weak_question_types}")
    print("Question Breakdown:")
    for q_id, q_info in diagnosis.question_breakdown.items():
        print(f"  • {q_id} [{q_info.type}]: Status={q_info.status}, Score={q_info.score}, Reason={q_info.error_reason}")
    print(f"\nDiagnostic Summary:\n{diagnosis.diagnostic_summary}")

    # Cleanup sample file
    if os.path.exists(sample_img_path):
        os.remove(sample_img_path)

    assert diagnosis.overall_score > 0.0
    assert len(diagnosis.weak_question_types) > 0


if __name__ == "__main__":
    test_performance_analyst_standalone()
