import { useState, useEffect } from 'react';
import { Loader2, HelpCircle, CheckCircle, XCircle, Info } from 'lucide-react';

interface Question {
  type: 'mcq' | 'tf' | 'fill';
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export default function QuizTab({ videoId }: { videoId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>(''); // For all types
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/generate/quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate quiz');
        setQuestions(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuiz();
  }, [videoId]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm">Generating interactive quiz...</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-400 text-sm text-center mt-10">Error: {error}</div>;
  }

  if (!questions || questions.length === 0) {
    return <div className="p-4 text-muted text-sm text-center mt-10">No questions available.</div>;
  }

  const currentQ = questions[currentIndex];
  
  const checkAnswer = (userAnswer: string) => {
    if (showResult) return;
    setSelectedOption(userAnswer);
    setShowResult(true);
    if (userAnswer.toLowerCase().trim() === currentQ.answer.toLowerCase().trim()) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setSelectedOption('');
      setShowResult(false);
    } else {
      setQuizFinished(true);
    }
  };

  if (quizFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-4 bg-background">
        <div className="w-24 h-24 rounded-full bg-surface border border-white/5 flex items-center justify-center mb-2 shadow-lg relative">
          <svg className="w-full h-full transform -rotate-90 absolute inset-0">
            <circle cx="48" cy="48" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-surface/50" />
            <circle cx="48" cy="48" r="45" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="283" strokeDashoffset={283 - (283 * percentage) / 100} className="text-primary transition-all duration-1000" />
          </svg>
          <span className="text-2xl font-bold text-text">{percentage}%</span>
        </div>
        <h2 className="text-[20px] font-semibold text-text">Quiz Complete!</h2>
        <p className="text-muted text-[14px]">You scored {score} out of {questions.length} correct.</p>
        <button 
          onClick={() => {
            setCurrentIndex(0);
            setSelectedOption('');
            setShowResult(false);
            setScore(0);
            setQuizFinished(false);
          }}
          className="mt-6 px-8 py-3 bg-primary text-white rounded-xl hover:bg-blue-600 transition-all font-medium shadow-md hover:shadow-lg shadow-primary/20 text-[14px]"
        >
          Retake Quiz
        </button>
      </div>
    );
  }

  const renderOptions = () => {
    if (currentQ.type === 'fill') {
      return (
        <div className="flex flex-col gap-4">
          <input 
            type="text"
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            disabled={showResult}
            placeholder="Type your answer..."
            className="w-full bg-surface border border-gray-600/50 rounded-xl px-4 py-3.5 text-[14px] text-text outline-none focus:border-primary transition-all disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !showResult && selectedOption.trim()) {
                checkAnswer(selectedOption);
              }
            }}
          />
          {!showResult && (
            <button 
              onClick={() => checkAnswer(selectedOption)}
              disabled={!selectedOption.trim()}
              className="px-4 py-3 bg-surface border border-white/5 rounded-xl hover:bg-surface/80 text-text disabled:opacity-50 transition-all text-[13px] font-medium w-max"
            >
              Submit Answer
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {currentQ.options.map((opt, i) => {
          let btnClass = "bg-surface border-gray-600/50 text-text hover:border-primary/50 hover:bg-surface/80";
          let Icon = null;
          
          if (showResult) {
            if (opt.toLowerCase().trim() === currentQ.answer.toLowerCase().trim()) {
              btnClass = "bg-green-500/10 border-green-500/50 text-green-400";
              Icon = CheckCircle;
            } else if (opt === selectedOption) {
              btnClass = "bg-red-500/10 border-red-500/50 text-red-400";
              Icon = XCircle;
            } else {
              btnClass = "bg-surface border-gray-600/50 text-muted opacity-50";
            }
          }

          return (
            <button
              key={i}
              onClick={() => checkAnswer(opt)}
              disabled={showResult}
              className={`relative w-full text-left p-4 rounded-xl border transition-all duration-200 text-[14px] ${btnClass}`}
            >
              <div className="flex items-center justify-between gap-4">
                <span>{opt}</span>
                {Icon && <Icon size={18} className="shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col relative bg-background">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-surface/20">
        <div className="flex items-center gap-2 text-primary font-medium text-[14px]">
          <HelpCircle size={16} /> Knowledge Check
        </div>
        <span className="text-[11px] font-semibold text-muted bg-surface/80 px-2.5 py-1 rounded-md border border-white/5">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-primary/70">
          {currentQ.type === 'mcq' ? 'Multiple Choice' : currentQ.type === 'tf' ? 'True or False' : 'Fill in the Blank'}
        </div>
        <h3 className="text-[16px] font-medium leading-relaxed text-text mb-8">
          {currentQ.question}
        </h3>
        
        {renderOptions()}

        {showResult && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className={`p-4 rounded-xl border ${
              selectedOption.toLowerCase().trim() === currentQ.answer.toLowerCase().trim() 
                ? 'bg-green-500/5 border-green-500/20' 
                : 'bg-red-500/5 border-red-500/20'
            }`}>
              <div className="flex items-start gap-3">
                <Info size={18} className="mt-0.5 shrink-0 text-muted" />
                <div>
                  <p className="text-[13px] font-medium text-text mb-1">
                    {selectedOption.toLowerCase().trim() === currentQ.answer.toLowerCase().trim() ? 'Correct!' : `Incorrect. The answer is ${currentQ.answer}.`}
                  </p>
                  <p className="text-[12px] text-muted leading-relaxed">
                    {currentQ.explanation}
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleNext}
              className="mt-6 w-full py-3.5 bg-primary text-white rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 text-[14px]"
            >
              {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
