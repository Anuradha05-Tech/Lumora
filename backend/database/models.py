from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class Video(Base):
    __tablename__ = 'videos'

    id = Column(String, primary_key=True, index=True) # YouTube Video ID
    title = Column(String, nullable=True)
    indexed_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="indexed")
    summaries_json = Column(Text, nullable=True) # Dictionary of {subtype: summary_text}
    notes = Column(Text, nullable=True)
    quiz_json = Column(Text, nullable=True)
    flashcards_json = Column(Text, nullable=True)
    timeline_json = Column(Text, nullable=True)

class ChatHistory(Base):
    __tablename__ = 'chat_history'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(String, index=True)
    role = Column(String) # 'user' or 'assistant'
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
