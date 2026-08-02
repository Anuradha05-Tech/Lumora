import os
from typing import List, Dict, Any, Generator
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_google_genai import ChatGoogleGenerativeAI

class RAGService:
    def __init__(self):
        # Embeddings: BAAI/bge-base-en-v1.5
        self.embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-base-en-v1.5")
        
        # ChromaDB setup
        self.persist_directory = "./chroma_db"
        self.vectorstore = Chroma(
            collection_name="youtube_transcripts",
            embedding_function=self.embeddings,
            persist_directory=self.persist_directory
        )
        
        # LLM setup (using Gemini)
        api_key = os.getenv("GEMINI_API_KEY")
        model_name = os.getenv("LLM_MODEL", "gemini-1.5-flash")
        
        self.llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.7
        )

    def process_and_index_transcript(self, video_id: str, transcript: List[Dict[str, Any]]) -> bool:
        """
        Process the transcript, chunk it, and index it into ChromaDB.
        """
        documents = []
        for entry in transcript:
            doc = Document(
                page_content=entry['text'],
                metadata={
                    "video_id": video_id,
                    "start": entry['start'],
                    "duration": entry['duration']
                }
            )
            documents.append(doc)
            
        # Custom logic to group small transcript lines into larger semantic chunks (~500 chars)
        docs_to_index = []
        temp_text = ""
        temp_start = None
        
        for doc in documents:
            if temp_start is None:
                temp_start = doc.metadata["start"]
            
            temp_text += doc.page_content + " "
            
            if len(temp_text) > 500:
                docs_to_index.append(
                    Document(
                        page_content=temp_text.strip(),
                        metadata={
                            "video_id": video_id,
                            "start": temp_start
                        }
                    )
                )
                temp_text = ""
                temp_start = None
                
        if temp_text:
             docs_to_index.append(
                Document(
                    page_content=temp_text.strip(),
                    metadata={
                        "video_id": video_id,
                        "start": temp_start if temp_start is not None else 0
                    }
                )
            )

        self.vectorstore.add_documents(docs_to_index)
        return True

    def chat_with_video(self, video_id: str, query: str, history: List[Dict[str, str]] = None) -> Generator[str, None, None]:
        """
        Stream an answer based on the video context and conversation history.
        """
        retriever = self.vectorstore.as_retriever(
            search_kwargs={"filter": {"video_id": video_id}, "k": 8}
        )
        
        # Format history string (limit to last 4 messages to save context window)
        history_str = ""
        if history:
            for msg in history[-4:]:
                role = "User" if msg['role'] == "user" else "Lumora"
                history_str += f"{role}: {msg['content']}\n\n"

        template = """You are Lumora, an AI learning assistant. Answer the user's question based ONLY on the provided transcript context from a YouTube video and the previous conversation history.
        
Conversation History:
{history}

Context:
{context}

Whenever you use information from the context, you MUST cite the timestamp using the exact start time provided in the metadata.
Format citations exactly like this: 📍[MM:SS] (calculate MM:SS from the start time in seconds).
If the context does not contain the answer, say "I don't have enough information from the video to answer that."

Question: {question}

Answer:"""
        prompt = ChatPromptTemplate.from_template(template)
        
        def format_docs(docs):
            formatted = []
            for d in docs:
                start_sec = int(d.metadata.get('start', 0))
                mins = start_sec // 60
                secs = start_sec % 60
                formatted.append(f"[Start Time: {start_sec}s / {mins:02d}:{secs:02d}] {d.page_content}")
            return "\n\n".join(formatted)
            
        chain = (
            {
                "context": retriever | format_docs, 
                "question": RunnablePassthrough(),
                "history": lambda x: history_str
            }
            | prompt
            | self.llm
            | StrOutputParser()
        )
        
        for chunk in chain.stream(query):
            yield chunk

    def generate_content(self, video_id: str, content_type: str, raw_transcript: List[Dict[str, Any]], subtype: str = None) -> str:
        """
        Generate specific content types (summary, notes, quiz, flashcards, timeline) based on the raw transcript.
        Truncates transcript to ~15,000 characters to avoid context window limits.
        """
        full_text = " ".join([t['text'] for t in raw_transcript])
        context = full_text[:15000]

        if content_type == "summary":
            mode_instructions = {
                "quick": "Create a brief, 3-sentence executive summary.",
                "detailed": "Create a highly detailed, comprehensive summary covering all major points.",
                "bullet": "Create a summary using ONLY bullet points.",
                "eli5": "Create a summary explaining the concepts simply, as if to a 5-year-old.",
                "revision": "Create a rapid-fire revision summary focusing only on testable facts and key takeaways."
            }
            instruction = mode_instructions.get(subtype, mode_instructions["quick"])
            
            template = f"""You are Lumora, a professional AI learning assistant. 
{instruction}
Use clean markdown formatting.

Transcript: {{context}}

Summary:"""
        elif content_type == "notes":
            template = """You are Lumora, a professional AI learning assistant. 
Create highly structured markdown notes from the following transcript.
You MUST include EXACTLY these sections with these exact Markdown headers:
# Introduction
# Main Concepts
# Definitions
# Examples
# Key Takeaways
# Interview Questions

Transcript: {context}

Notes:"""
        elif content_type == "quiz":
            template = """You are Lumora, a professional AI learning assistant. 
Create a 3-question quiz based on the following transcript.
You MUST output ONLY a valid JSON array of objects. Do not include markdown code blocks.
Include one Multiple Choice (mcq), one True/False (tf), and one Fill-in-the-blank (fill).
Format exactly like this:
[
  {"type": "mcq", "question": "Q1?", "options": ["A", "B", "C", "D"], "answer": "B", "explanation": "Why B is correct"},
  {"type": "tf", "question": "Statement?", "options": ["True", "False"], "answer": "True", "explanation": "Why True"},
  {"type": "fill", "question": "The sky is ___", "options": [], "answer": "blue", "explanation": "Fact"}
]

Transcript: {context}

JSON Output:"""
        elif content_type == "timeline":
            template = """You are Lumora, a professional AI learning assistant. 
Analyze the transcript and generate an "Important Timeline" of the 5 most crucial topics.
You MUST output ONLY a valid JSON array of objects. Do not include markdown code blocks.
Extract the timestamp for when each topic begins based on the context (guess the MM:SS if necessary based on flow, but be sequential).
Format exactly like this:
[
  {"time": "00:00", "label": "Introduction"},
  {"time": "03:15", "label": "First Main Topic"}
]

Transcript: {context}

JSON Output:"""
        elif content_type == "flashcards":
            template = """You are Lumora, a professional AI learning assistant. 
Create 5 flashcards (Question and Answer pairs) based on the most important concepts in the following transcript.
You MUST output ONLY a valid JSON array of objects. Do not include markdown code blocks or any other text.
Format exactly like this: [{"question": "What is X?", "answer": "X is Y."}]

Transcript: {context}

JSON Output:"""
        else:
            raise ValueError("Invalid content type")

        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | self.llm | StrOutputParser()
        
        response = chain.invoke({"context": context})
        
        # Strip potential markdown formatting from JSON outputs
        if content_type in ["quiz", "flashcards", "timeline"]:
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            response = response.strip()
            
        return response

# Singleton instance
rag_service = RAGService()
