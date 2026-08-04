# Lumora

![demo](docs/demo.gif)
Lumora is an AI-powered learning assistant provided as a Chrome Extension, designed specifically for YouTube videos. 

## Known Limitations

- **Database Concurrency:** The backend currently uses SQLite. Under heavy concurrent load, you may encounter database locking issues since SQLite is not designed for high-concurrency environments.
- **Authentication:** There is currently no user authentication system implemented. All interactions are processed anonymously, and rate limiting relies on client IP or generated install IDs.
- **Rate Limiting Persistence:** The API rate limiting is implemented in-memory. Restarting the backend server will immediately reset all active rate limit quotas.
- **Audio Fallback Latency:** For YouTube videos without captions, Lumora falls back to downloading the full audio track and processing it natively. This process introduces significant latency before the video is fully indexed and ready for interaction.
