import { useState, useEffect } from 'react';
import { Loader2, LayoutGrid, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

export default function FlashcardsTab({ videoId }: { videoId: string }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/generate/flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate flashcards');
        setCards(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCards();
  }, [videoId]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm">Generating smart flashcards...</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm text-center mt-10">Error: {error}</div>;
  }

  if (!cards || cards.length === 0) {
    return <div className="p-4 text-muted text-sm text-center mt-10">No flashcards available.</div>;
  }

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  const currentCard = cards[currentIndex];

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar pb-24">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-2 text-primary">
          <LayoutGrid size={20} />
          <h2 className="font-semibold text-lg text-text">Spaced Repetition</h2>
        </div>
        <span className="text-sm font-medium text-muted bg-surface/50 px-3 py-1 rounded-full border border-white/5">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center perspective-1000 relative">
        <div 
          className={`relative w-full h-[300px] transition-transform duration-500 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Front (Question) */}
          <div className="absolute inset-0 backface-hidden bg-surface border border-gray-600/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-lg hover:border-primary/30 transition-colors">
            <span className="absolute top-4 left-4 text-xs font-bold uppercase tracking-wider text-primary/70">Question</span>
            <p className="text-lg font-medium text-text leading-relaxed">{currentCard.question}</p>
            <p className="absolute bottom-4 text-xs text-muted flex items-center gap-1 opacity-60">
              <RotateCcw size={12} /> Click to reveal
            </p>
          </div>

          {/* Back (Answer) */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-primary/10 border border-primary/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-lg shadow-primary/5">
            <span className="absolute top-4 left-4 text-xs font-bold uppercase tracking-wider text-primary">Answer</span>
            <p className="text-[15px] text-text leading-relaxed whitespace-pre-wrap overflow-y-auto custom-scrollbar max-h-full py-4">
              {currentCard.answer}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8">
        <button 
          onClick={handlePrev}
          className="p-3 rounded-full bg-surface border border-gray-600/50 hover:bg-surface/80 text-text transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          onClick={() => setIsFlipped(!isFlipped)}
          className="px-6 py-2.5 rounded-full bg-surface border border-gray-600/50 hover:bg-surface/80 text-text font-medium text-sm transition-colors"
        >
          Flip Card
        </button>
        <button 
          onClick={handleNext}
          className="p-3 rounded-full bg-primary hover:bg-blue-600 text-white shadow-lg shadow-primary/20 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
