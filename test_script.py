import urllib.request
import json
import os
from PIL import Image

img = Image.new('RGB', (300, 300), color='white')
img.save('test_sheet.jpg')

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
with open('test_sheet.jpg', 'rb') as f:
    img_bytes = f.read()

body_parts = [
    f'--{boundary}'.encode('utf-8'),
    b'Content-Disposition: form-data; name="file"; filename="test_sheet.jpg"',
    b'Content-Type: image/jpeg',
    b'',
    img_bytes,
    f'--{boundary}--'.encode('utf-8'),
    b''
]
body = b'\r\n'.join(body_parts)

req = urllib.request.Request(
    'http://localhost:8000/api/agents/analyze-answer-sheet',
    data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)

try:
    res = urllib.request.urlopen(req, timeout=10)
    data = json.loads(res.read().decode())
    print('HTTP Status:', res.status)
    print('Diagnosis Overall Score:', data['diagnosis']['overall_score'])
    print('Detected Topic:', data['diagnosis']['detected_topic'])
    print('Weak Types:', data['diagnosis']['weak_question_types'])
except urllib.error.URLError as e:
    print('Failed to connect to backend server:', e)
except Exception as e:
    print('Error during API request:', e)

if os.path.exists('test_sheet.jpg'):
    os.remove('test_sheet.jpg')
