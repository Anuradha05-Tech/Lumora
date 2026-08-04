import os
import yt_dlp
from google import genai

class AudioService:
    @staticmethod
    def upload_audio(video_id: str) -> str:
        """
        Downloads the lowest quality audio from YouTube and uploads it to Gemini.
        Returns the Gemini file URI.
        """
        url = f"https://www.youtube.com/watch?v={video_id}"
        output_path = f"/tmp/lumora_{video_id}.mp3"
        
        # Download audio using yt-dlp
        ydl_opts = {
            'format': 'worstaudio/worst', # Fetch lowest quality to save bandwidth/time
            'outtmpl': output_path,
            'quiet': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
            # Upload to Gemini
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise Exception("GEMINI_API_KEY is not set.")
                
            client = genai.Client(api_key=api_key)
            
            # The uploaded file persists on Google's servers for 48 hours by default.
            uploaded_file = client.files.upload(file=output_path)
            
            # Clean up the local file
            if os.path.exists(output_path):
                os.remove(output_path)
                
            return uploaded_file.uri
            
        except Exception as e:
            if os.path.exists(output_path):
                os.remove(output_path)
            raise Exception(f"Audio fallback failed: {str(e)}")
