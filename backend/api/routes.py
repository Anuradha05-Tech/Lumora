from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from services.transcript_service import TranscriptService
from services.rag_service import rag_service
from services.rate_limiter import get_rate_limiter
from database.db import get_db, SessionLocal
from database.models import Video
from fastapi.responses import StreamingResponse

router = APIRouter()

class ProcessVideoRequest(BaseModel):
    video_id: str
    title: Optional[str] = None

class ChatRequest(BaseModel):
    video_id: str
    query: str
    history: Optional[List[Dict[str, str]]] = []

class GenerateRequest(BaseModel):
    video_id: str
    subtype: Optional[str] = None

def process_video_task(video_id: str, title: str):
    db = SessionLocal()
    try:
        audio_uri = None
        try:
            transcript = TranscriptService.get_transcript(video_id)
            rag_service.process_and_index_transcript(video_id, transcript)
        except Exception as transcript_err:
            print(f"Transcript fetch failed for {video_id}. Falling back to native audio... Error: {transcript_err}")
            from services.audio_service import AudioService
            audio_uri = AudioService.upload_audio(video_id)
            
        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.audio_file_uri = audio_uri
            video.status = "done"
            db.commit()
    except Exception as e:
        print(f"Error in background task for {video_id}: {e}")
        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.status = "failed"
            db.commit()
    finally:
        db.close()

@router.post("/process_video")
def process_video(request: ProcessVideoRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    video_id = request.video_id
    
    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        if video.status in ["done", "failed"]:
            return {"status": "success", "message": "Video already processed.", "job_id": video_id}
        else:
            return {"status": "success", "message": "Video processing in progress.", "job_id": video_id}
            
    try:
        new_video = Video(id=video_id, title=request.title, status="processing")
        db.add(new_video)
        db.commit()
        
        background_tasks.add_task(process_video_task, video_id, request.title)
        
        return {"status": "success", "message": "Video processing started in background.", "job_id": video_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{job_id}")
def get_status(job_id: str, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == job_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": video.status}

@router.post("/chat")
def chat_with_video(request: ChatRequest, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == request.video_id).first()
    audio_uri = video.audio_file_uri if video else None
    
    def iter_response():
        for chunk in rag_service.chat_with_video(request.video_id, request.query, request.history, audio_uri):
            yield chunk
            
    return StreamingResponse(iter_response(), media_type="text/event-stream")

@router.post("/generate/{content_type}")
def generate_content(content_type: str, request: GenerateRequest, db: Session = Depends(get_db), _: None = Depends(get_rate_limiter)):
    valid_types = ["summary", "notes", "quiz", "flashcards", "timeline"]
    if content_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid content type")

    video_id = request.video_id
    video = db.query(Video).filter(Video.id == video_id).first()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found in database. Please process it first.")

    import json

    # 1. Check Cache
    if content_type == "summary":
        subtype = request.subtype or "quick"
        summaries = {}
        if video.summaries_json:
            try:
                summaries = json.loads(video.summaries_json)
            except:
                pass
        if subtype in summaries:
            return {"status": "success", "data": summaries[subtype]}
    else:
        cache_field = "notes" if content_type == "notes" else f"{content_type}_json"
        cached_content = getattr(video, cache_field)
        
        if cached_content:
            if content_type in ["quiz", "flashcards", "timeline"]:
                try:
                    return {"status": "success", "data": json.loads(cached_content)}
                except:
                    pass # If JSON parsing fails, regenerate it
            else:
                return {"status": "success", "data": cached_content}

    # 2. Generate Content
    try:
        if video.audio_file_uri:
            raw_transcript = []
        else:
            raw_transcript = TranscriptService.get_transcript(video_id)
            
        generated_result = rag_service.generate_content(video_id, content_type, raw_transcript, subtype=request.subtype, audio_uri=video.audio_file_uri)
        
        # 3. Save to Cache
        if content_type == "summary":
            subtype = request.subtype or "quick"
            summaries = {}
            if video.summaries_json:
                try:
                    summaries = json.loads(video.summaries_json)
                except:
                    pass
            summaries[subtype] = generated_result
            video.summaries_json = json.dumps(summaries)
        else:
            setattr(video, cache_field, generated_result)
            
        db.commit()
        
        if content_type in ["quiz", "flashcards", "timeline"]:
            return {"status": "success", "data": json.loads(generated_result)}
        return {"status": "success", "data": generated_result}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
