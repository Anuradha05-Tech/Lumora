import { useState, useEffect } from 'react';
import { Loader2, Zap, FileText, List, Baby, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SUMMARY_MODES = [
  { id: 'quick', label: 'Quick', icon: Zap },
  { id: 'detailed', label: 'Detailed', icon: FileText },
  { id: 'bullet', label: 'Bullet', icon: List },
  { id: 'eli5', label: 'ELI5', icon: Baby },
  { id: 'revision', label: 'Revision', icon: BookOpen }
];

export default function SummaryTab({ videoId }: { videoId: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState('quick');

  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);
      setContent(null);
      try {
        const res = await fetch(`http://localhost:8000/api/generate/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId, subtype: activeMode })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate summary');
        setContent(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContent();
  }, [videoId, activeMode]);

  return (
    <div className="h-full flex flex-col font-sans relative">
      {/* Mode Selector */}
      <div className="px-6 py-4 border-b border-white/5 bg-surface/20 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
        {SUMMARY_MODES.map(mode => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all shrink-0 ${
                isActive 
                  ? 'bg-primary text-white shadow-md shadow-primary/20 border border-primary' 
                  : 'bg-surface/50 text-muted border border-white/5 hover:bg-surface hover:text-text'
              }`}
            >
              <Icon size={14} className={isActive ? 'opacity-100' : 'opacity-70'} />
              {mode.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-[13px]">Generating {activeMode} summary...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-red-400 text-[13px] text-center mt-10 bg-red-500/10 rounded-xl border border-red-500/20">
            Error: {error}
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none text-[15px] leading-relaxed text-text">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
