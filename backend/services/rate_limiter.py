import os
import time
from typing import Dict, List
from fastapi import Request, HTTPException

class RateLimiter:
    def __init__(self):
        self.requests = int(os.getenv("RATE_LIMIT_REQUESTS", "10"))
        self.window_sec = int(os.getenv("RATE_LIMIT_WINDOW_SEC", "60"))
        # Store timestamps of requests keyed by user identifier
        self.history: Dict[str, List[float]] = {}

    def _cleanup_old_requests(self, identifier: str, current_time: float):
        if identifier in self.history:
            self.history[identifier] = [
                t for t in self.history[identifier] 
                if current_time - t <= self.window_sec
            ]
            if not self.history[identifier]:
                del self.history[identifier]

    def check_rate_limit(self, identifier: str):
        current_time = time.time()
        self._cleanup_old_requests(identifier, current_time)

        user_history = self.history.get(identifier, [])
        if len(user_history) >= self.requests:
            raise HTTPException(
                status_code=429, 
                detail="Too many requests. Please try again later."
            )
        
        user_history.append(current_time)
        self.history[identifier] = user_history

rate_limiter_instance = RateLimiter()

def get_rate_limiter(request: Request):
    # Try to get extension's install ID, otherwise fallback to client IP
    identifier = request.headers.get("X-Install-ID")
    if not identifier:
        identifier = request.client.host if request.client else "unknown_ip"
    
    rate_limiter_instance.check_rate_limit(identifier)
