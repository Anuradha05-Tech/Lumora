import requests

video_id = "EzYaFF7ahKw"
print("Chatting...")
try:
    res = requests.post("http://localhost:8000/api/chat", json={"video_id": video_id, "query": "What is this about?", "history": []}, stream=True, timeout=10)
    for line in res.iter_lines():
        if line:
            print(line.decode('utf-8'))
except Exception as e:
    print("Error:", e)
