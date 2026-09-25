import urllib.request
import json

extracted_text = """
CLASS 11-A : ADVANCED CALCULUS & DERIVATIVES
Student: Alex Mercer | Date: 2026-09-25 | Exam Paper
Q1: Differentiate f(x) = sin(x^2). (MCQ)
Answer: cos(x^2) * 2x [Correct (+2)]
Q2: Find derivative of g(x) = (3x^2 - 5)^4 using Chain Rule. (Derivation)
Answer: 4(3x^2 - 5)^3 * (3x) = 12x(3x^2 - 5)^3 [Forgot derivative of 3x^2 is 6x!] [Step 2 Error (-4)]
Q3: Evaluate limit x->0 of (sin x)/x. (Calculation)
Answer: 1 (by standard trigonometric limit) [Correct (+2)]
Q4: Find tangent line slope for y = x^3 at x = 2. (Derivation)
Answer: dy/dx = 3x^2 -> slope = 3(4) = 12 [Correct (+2)]
"""

prompt = f"""You are an expert academic evaluator AI.
Analyze the following student answer sheet:
\"\"\"{extracted_text}\"\"\"

Return ONLY a valid JSON object with these keys:
"overall_score": float (0.0 to 1.0),
"detected_topic": string,
"weak_question_types": list of strings,
"question_breakdown": dict of question details,
"diagnostic_summary": string.

JSON:"""

payload = {
    'model': 'gemma4:latest',
    'prompt': prompt,
    'stream': False
}

req = urllib.request.Request(
    'http://localhost:11434/api/generate',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    res = urllib.request.urlopen(req, timeout=60)
    data = json.loads(res.read().decode())
    print("SUCCESS! Output:")
    print(data.get('response'))
except Exception as e:
    print("FAILED:", e)
