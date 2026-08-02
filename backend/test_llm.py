import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.rag_service import RAGService
import time

print("Init RAG...")
rag = RAGService()
print("Invoking LLM...")
start = time.time()
try:
    res = rag.llm.invoke("Hello")
    print("Res:", res)
except Exception as e:
    print("Error:", e)
print("Took", time.time() - start)
