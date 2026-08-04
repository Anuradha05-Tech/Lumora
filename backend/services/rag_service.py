import os
from typing import List, Dict, Any, Generator
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableBranch
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage

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
            
        # Semantic chunking preserving timestamps with overlap (~1000 chars, ~200 chars overlap)
        docs_to_index = []
        current_chunk = ""
        chunk_start = None
        
        for i, entry in enumerate(transcript):
            if chunk_start is None:
                chunk_start = entry['start']
                
            current_chunk += entry['text'] + " "
            
            if len(current_chunk) >= 1000:
                docs_to_index.append(
                    Document(
                        page_content=current_chunk.strip(),
                        metadata={
                            "video_id": video_id,
                            "start": chunk_start
                        }
                    )
                )
                # Create overlap using the last 2-3 transcript entries
                overlap_entries = transcript[max(0, i-2):i+1]
                current_chunk = "".join([e['text'] + " " for e in overlap_entries])
                chunk_start = overlap_entries[0]['start'] if overlap_entries else entry['start']
                
        if current_chunk.strip():
             docs_to_index.append(
                Document(
                    page_content=current_chunk.strip(),
                    metadata={
                        "video_id": video_id,
                        "start": chunk_start if chunk_start is not None else 0
                    }
                )
            )

        self.vectorstore.add_documents(docs_to_index)
        return True

    def chat_with_video(self, video_id: str, query: str, history: List[Dict[str, str]] = None, audio_uri: str = None) -> Generator[str, None, None]:
        """
        Stream an answer based on the video context and conversation history.
        """
        if audio_uri:
            from google import genai
            from google.genai import types
            import os
            client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
            model_name = os.getenv("LLM_MODEL", "gemini-flash-lite-latest")
            audio_part = types.Part.from_uri(file_uri=audio_uri, mime_type="audio/mp3")
            qa_system_prompt = "You are Lumora, an AI learning assistant. Answer the user's question based ONLY on the provided audio from a YouTube video. If you cite time, guess the timestamp like 📍[MM:SS] based on the audio. If the audio does not contain the answer, say 'I don't have enough information from the video to answer that.'"
            contents = []
            if history:
                for msg in history[-6:]:
                    role = "user" if msg['role'] == "user" else "model"
                    contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg['content'])]))
            contents.append(types.Content(role="user", parts=[audio_part, types.Part.from_text(text=query)]))
            response = client.models.generate_content_stream(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(system_instruction=qa_system_prompt, temperature=0.7)
            )
            for chunk in response:
                yield chunk.text
            return
            
        retriever = self.vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={"filter": {"video_id": video_id}, "k": 5, "fetch_k": 20}
        )
        
        # Convert history to Langchain Messages (limit to last 6 to save context)
        chat_history = []
        if history:
            for msg in history[-6:]:
                if msg['role'] == "user":
                    chat_history.append(HumanMessage(content=msg['content']))
                else:
                    chat_history.append(AIMessage(content=msg['content']))

        # 1. Contextualize Question (History-Aware Retriever)
        contextualize_q_system_prompt = """Given a chat history and the latest user question \
which might reference context in the chat history, formulate a standalone question \
which can be understood without the chat history. Do NOT answer the question, \
just reformulate it if needed and otherwise return it as is."""
        
        contextualize_q_prompt = ChatPromptTemplate.from_messages([
            ("system", contextualize_q_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{question}"),
        ])
        
        history_aware_retriever = RunnableBranch(
            (lambda x: not x.get("chat_history", False), RunnablePassthrough() | (lambda x: x["question"]) | retriever),
            contextualize_q_prompt | self.llm | StrOutputParser() | retriever
        )

        # 2. Answer Question
        qa_system_prompt = """You are Lumora, an AI learning assistant. Answer the user's question based ONLY on the provided transcript context from a YouTube video.
        
Context:
{context}

Whenever you use information from the context, you MUST cite the timestamp using the exact start time provided in the metadata.
Format citations exactly like this: 📍[MM:SS] (calculate MM:SS from the start time in seconds).
If the context does not contain the answer, say "I don't have enough information from the video to answer that."
"""
        qa_prompt = ChatPromptTemplate.from_messages([
            ("system", qa_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{question}"),
        ])
        
        def format_docs(docs):
            formatted = []
            for d in docs:
                start_sec = int(d.metadata.get('start', 0))
                mins = start_sec // 60
                secs = start_sec % 60
                formatted.append(f"[Start Time: {start_sec}s / {mins:02d}:{secs:02d}] {d.page_content}")
            return "\n\n".join(formatted)
            
        chain = (
            RunnablePassthrough.assign(
                context=history_aware_retriever | format_docs
            )
            | qa_prompt
            | self.llm
            | StrOutputParser()
        )
        
        for chunk in chain.stream({"question": query, "chat_history": chat_history}):
            yield chunk

    def generate_content(self, video_id: str, content_type: str, raw_transcript: List[Dict[str, Any]], subtype: str = None, audio_uri: str = None) -> str:
        """
        Generate specific content types (summary, notes, quiz, flashcards, timeline) based on the raw transcript or native audio.
        Truncates transcript to ~500,000 characters to avoid context window limits.
        """
        if raw_transcript:
            full_text = " ".join([t['text'] for t in raw_transcript])
            context = full_text[:500000]
        else:
            context = ""

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
Create a 20-question quiz based on the following transcript.
You MUST output ONLY a valid JSON array containing exactly 20 question objects. Do not include markdown code blocks.
Include a variety of Multiple Choice (mcq), True/False (tf), and Fill-in-the-blank (fill) questions.
Format the JSON array exactly like this example (but with 20 items):
[
  {{"type": "mcq", "question": "Q1?", "options": ["A", "B", "C", "D"], "answer": "B", "explanation": "Why B is correct"}},
  {{"type": "tf", "question": "Statement?", "options": ["True", "False"], "answer": "True", "explanation": "Why True"}},
  {{"type": "fill", "question": "The sky is ___", "options": [], "answer": "blue", "explanation": "Fact"}}
]

Transcript: {context}

JSON Output:"""
        elif content_type == "timeline":
            template = """You are Lumora, a professional AI learning assistant. 
Analyze the transcript and generate a comprehensive "Important Timeline" covering the ENTIRE video from start to finish.
You MUST extract ALL major topics and ensure the timeline spans the entire duration of the video. Do not stop early! You must include events from the middle and the very end of the video.
You MUST output ONLY a valid JSON array of objects. Do not include markdown code blocks.
Extract the timestamp for when each topic begins based on the context (guess the MM:SS if necessary based on flow, but be sequential).
Format exactly like this example (but generate as many items as needed to cover the whole video):
[
  {{"time": "00:00", "label": "Introduction"}},
  {{"time": "03:15", "label": "First Main Topic"}},
  {{"time": "14:20", "label": "Another Topic"}}
]

Transcript: {context}

JSON Output:"""
        elif content_type == "flashcards":
            template = """You are Lumora, a professional AI learning assistant. 
Create 5 flashcards (Question and Answer pairs) based on the most important concepts in the following transcript.
You MUST output ONLY a valid JSON array of objects. Do not include markdown code blocks or any other text.
Format exactly like this: [{{"question": "What is X?", "answer": "X is Y."}}]

Transcript: {context}

JSON Output:"""
        else:
            raise ValueError("Invalid content type")

        if audio_uri:
            from google import genai
            from google.genai import types
            import os
            client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
            model_name = os.getenv("LLM_MODEL", "gemini-flash-lite-latest")
            audio_part = types.Part.from_uri(file_uri=audio_uri, mime_type="audio/mp3")
            prompt_text = template.replace("{context}", "[Audio Track Provided]")
            
            response = client.models.generate_content(
                model=model_name,
                contents=[audio_part, prompt_text],
                config=types.GenerateContentConfig(temperature=0.7)
            )
            response_text = response.text
        else:
            prompt = ChatPromptTemplate.from_template(template)
            chain = prompt | self.llm | StrOutputParser()
            response_text = chain.invoke({"context": context})
        
        # Strip potential markdown formatting from JSON outputs
        if content_type in ["quiz", "flashcards", "timeline"]:
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
        return response_text

# Singleton instance
rag_service = RAGService()
