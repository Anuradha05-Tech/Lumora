import { useState, useEffect } from 'react';
import { Loader2, Clock, PlayCircle } from 'lucide-react';

interface TimelineEvent {
  time: string;
  label: string;
}

export default function TimelineTab({ videoId }: { videoId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/generate/timeline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate timeline');
        setEvents(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimeline();
  }, [videoId]);

  const handleSeek = (timeStr: string) => {
    const parts = timeStr.split(':').map(Number);
    let timeInSeconds = 0;
    if (parts.length === 3) {
      timeInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      timeInSeconds = parts[0] * 60 + parts[1];
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'seekTo', time: timeInSeconds });
      }
    });
  };

  return (
    <div className="h-full flex flex-col relative bg-background">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2 text-primary font-medium text-[14px] shrink-0 bg-surface/20">
        <Clock size={16} /> Important Timeline
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-[13px]">Analyzing video chapters...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-red-400 text-[13px] text-center mt-10 bg-red-500/10 rounded-xl border border-red-500/20">
            Error: {error}
          </div>
        ) : !events || events.length === 0 ? (
          <div className="p-4 text-muted text-sm text-center mt-10">No timeline events found.</div>
        ) : (
          <div className="relative border-l border-white/10 ml-3 py-2">
            {events.map((event, index) => (
              <div key={index} className="mb-8 pl-6 relative group">
                <div className="absolute w-3 h-3 bg-primary rounded-full -left-[6.5px] top-1.5 ring-4 ring-background transition-transform group-hover:scale-125" />
                <div 
                  onClick={() => handleSeek(event.time)}
                  className="bg-surface/30 border border-white/5 p-3 rounded-xl cursor-pointer hover:bg-surface hover:border-primary/30 transition-all flex items-center justify-between group-hover:shadow-md"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[14px] font-medium text-text group-hover:text-primary transition-colors">{event.label}</span>
                    <span className="text-[12px] text-muted flex items-center gap-1"><PlayCircle size={12} /> {event.time}</span>
                  </div>
                  <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Jump →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
