from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from services.transcript_service import TranscriptService
from services.rag_service import rag_service
from database.db import get_db
from database.models import Video
from fastapi.responses import StreamingResponse

router = APIRouter()

class ProcessVideoRequest(BaseModel):
    video_id: str
    title: Optional[str] = None

class ChatRequest(BaseModel):
    video_id: str
    query: str

@router.post("/process_video")
def process_video(request: ProcessVideoRequest, db: Session = Depends(get_db)):
    video_id = request.video_id
    
    # Check if video already exists
    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        return {"status": "success", "message": "Video already processed."}
        
    try:
        # Fetch transcript
        transcript = TranscriptService.get_transcript(video_id)
        
        # Process and index
        rag_service.process_and_index_transcript(video_id, transcript)
        
        # Save to DB
        new_video = Video(id=video_id, title=request.title)
        db.add(new_video)
        db.commit()
        
        return {"status": "success", "message": "Video processed and indexed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
def chat_with_video(request: ChatRequest):
    def iter_response():
        for chunk in rag_service.chat_with_video(request.video_id, request.query):
            yield chunk
            
    return StreamingResponse(iter_response(), media_type="text/event-stream")
