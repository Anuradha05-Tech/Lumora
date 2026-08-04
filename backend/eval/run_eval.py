import json
import os
import requests
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Load environment variables (assumes you run this from the backend directory)
load_dotenv()

EVAL_FILE = "eval/qa_pairs.json"
RESULTS_FILE = "eval/results.json"
CHAT_ENDPOINT = "http://localhost:8000/api/chat"

def get_generated_answer(video_id: str, question: str) -> str:
    """Calls the local chat endpoint and aggregates the streaming response."""
    payload = {
        "video_id": video_id,
        "query": question,
        "history": []
    }
    
    try:
        # We need to stream the response and decode it
        with requests.post(CHAT_ENDPOINT, json=payload, stream=True) as response:
            response.raise_for_status()
            full_answer = ""
            for chunk in response.iter_content(chunk_size=None, decode_unicode=True):
                if chunk:
                    full_answer += chunk
            return full_answer
    except requests.exceptions.RequestException as e:
        print(f"Error calling chat endpoint for video {video_id}: {e}")
        return ""

def evaluate_answer(question: str, ideal_answer: str, generated_answer: str, evaluator) -> int:
    """Uses Gemini as a judge to return a 1-5 score."""
    if not generated_answer:
        return 0

    prompt = ChatPromptTemplate.from_template(
        "You are an impartial judge evaluating a RAG AI system's answer.\n"
        "Question: {question}\n"
        "Ideal Answer: {ideal_answer}\n"
        "Generated Answer: {generated_answer}\n\n"
        "Compare the Generated Answer to the Ideal Answer. Give a score from 1 to 5 based on correctness, where 1 is completely wrong and 5 is perfectly correct and encompasses all the meaning of the ideal answer.\n"
        "Respond ONLY with a single integer between 1 and 5."
    )
    
    chain = prompt | evaluator | StrOutputParser()
    
    try:
        result = chain.invoke({
            "question": question,
            "ideal_answer": ideal_answer,
            "generated_answer": generated_answer
        })
        score = int(result.strip())
        # Ensure score is in range 1-5
        return max(1, min(5, score))
    except Exception as e:
        print(f"Error evaluating answer: {e}")
        return 0

def run_eval():
    if not os.path.exists(EVAL_FILE):
        print(f"Evaluation file {EVAL_FILE} not found.")
        return

    with open(EVAL_FILE, "r") as f:
        qa_pairs = json.load(f)

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in environment.")
        return

    # Use a solid model for evaluation
    model_name = os.getenv("LLM_MODEL", "gemini-flash-lite-latest")
    evaluator = ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        temperature=0.0
    )

    results = []
    total_score = 0
    valid_evaluations = 0

    print(f"Starting evaluation of {len(qa_pairs)} questions...")

    for idx, pair in enumerate(qa_pairs):
        video_id = pair.get("video_id")
        question = pair.get("question")
        ideal_answer = pair.get("ideal_answer")

        # Skip placeholders
        if video_id.startswith("PLACEHOLDER"):
            print(f"Skipping placeholder entry {idx + 1}")
            continue

        print(f"Evaluating {idx + 1}/{len(qa_pairs)}: {question}")
        
        generated_answer = get_generated_answer(video_id, question)
        score = evaluate_answer(question, ideal_answer, generated_answer, evaluator)

        result_entry = {
            "video_id": video_id,
            "question": question,
            "ideal_answer": ideal_answer,
            "generated_answer": generated_answer,
            "score": score
        }
        results.append(result_entry)
        
        if score > 0:
            total_score += score
            valid_evaluations += 1

    avg_score = (total_score / valid_evaluations) if valid_evaluations > 0 else 0

    final_output = {
        "average_score": avg_score,
        "results": results
    }

    with open(RESULTS_FILE, "w") as f:
        json.dump(final_output, f, indent=2)

    print("\n--- Evaluation Complete ---")
    print(f"Average Score: {avg_score:.2f} / 5.0")
    print(f"Results written to {RESULTS_FILE}")

if __name__ == "__main__":
    run_eval()
