from youtube_transcript_api import YouTubeTranscriptApi
from typing import List, Dict, Any

class TranscriptService:
    @staticmethod
    def _get_api():
        import requests
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        })
        return YouTubeTranscriptApi(http_client=session)

    @staticmethod
    def get_transcript(video_id: str) -> List[Dict[str, Any]]:
        """
        Fetches the transcript for a given YouTube video ID.
        Returns a list of dictionaries with 'text', 'start', and 'duration' keys.
        """
        try:
            ytt_api = TranscriptService._get_api()
            fetched = ytt_api.fetch(video_id, languages=["en"])
            return [{"text": snippet.text, "start": snippet.start, "duration": snippet.duration} for snippet in fetched]
        except Exception as e:
            # If English is not available, try to fetch the first available transcript
            try:
                ytt_api = TranscriptService._get_api()
                transcript_list = ytt_api.list(video_id)
                # Fetch first available
                first_transcript = next(iter(transcript_list))
                fetched = first_transcript.fetch()
                return [{"text": snippet.text, "start": snippet.start, "duration": snippet.duration} for snippet in fetched]
            except Exception as e_inner:
                raise Exception(f"Could not retrieve transcript for video {video_id}. Error: {str(e_inner)}")

    @staticmethod
    def format_transcript_for_indexing(transcript: List[Dict[str, Any]]) -> str:
        """
        Combines the transcript into a single string if needed, 
        but usually we want to keep chunks with timestamps.
        """
        formatted = []
        for entry in transcript:
            start_time = int(entry['start'])
            text = entry['text'].replace('\n', ' ')
            formatted.append(f"[{start_time}] {text}")
        return " ".join(formatted)
