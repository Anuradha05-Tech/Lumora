import os
from typing import List, Dict, Any, Generator
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace

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
        
        # LLM setup (using openai compatible API, configurable via env vars)
        api_key = os.getenv("LLM_API_KEY", "dummy")
        base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        model_name = os.getenv("LLM_MODEL", "qwen-2.5-72b-instruct") # Placeholder
        
        self.llm = ChatHuggingFace(
            llm=HuggingFaceEndpoint(
                repo_id=model_name,
                task="text-generation",
                max_new_tokens=512,
                huggingfacehub_api_token=api_key
            )
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

    def chat_with_video(self, video_id: str, query: str) -> Generator[str, None, None]:
        """
        Stream an answer based on the video context.
        """
        retriever = self.vectorstore.as_retriever(
            search_kwargs={"filter": {"video_id": video_id}, "k": 5}
        )
        
        template = """You are Lumora, an AI learning assistant. Answer the user's question based ONLY on the provided transcript context from a YouTube video.
        
Context: {context}

Whenever you use information from the context, you MUST cite the timestamp using the exact start time provided in the metadata.
Format citations exactly like this: 📍[MM:SS] (calculate MM:SS from the start time in seconds).

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
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | self.llm
            | StrOutputParser()
        )
        
        for chunk in chain.stream(query):
            yield chunk

# Singleton instance
rag_service = RAGService()
