import { useState, useEffect } from 'react'
import { MessageSquare, FileText, AlignLeft, HelpCircle, LayoutGrid } from 'lucide-react'
import ChatTab from './components/ChatTab'

// Dummy components for other tabs
const NotesTab = () => <div className="p-4">Notes coming soon...</div>
const SummaryTab = () => <div className="p-4">Summary coming soon...</div>
const QuizTab = () => <div className="p-4">Quiz coming soon...</div>
const FlashcardsTab = () => <div className="p-4">Flashcards coming soon...</div>

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexError, setIndexError] = useState<string | null>(null)

  useEffect(() => {
    // Get current tab URL to extract video ID
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      const url = tabs[0]?.url
      if (url && url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url).search)
        const v = urlParams.get('v')
        if (v) setVideoId(v)
      }
    })
  }, [])

  useEffect(() => {
    if (!videoId) return
    const processVideo = async () => {
      setIsIndexing(true)
      setIndexError(null)
      try {
        const res = await fetch('http://localhost:8000/api/process_video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId })
        })
        if (!res.ok) throw new Error('Failed to index video')
      } catch (err: any) {
        setIndexError(err.message)
      } finally {
        setIsIndexing(false)
      }
    }
    processVideo()
  }, [videoId])

  if (!videoId) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted">
        <p>Please open a YouTube video to use Lumora.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background text-text">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-surface shadow-sm">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          Lumora
        </h1>
        <div className="text-xs font-medium">
          {isIndexing ? (
            <span className="text-yellow-400 flex items-center gap-1">
              <span className="animate-pulse h-2 w-2 bg-yellow-400 rounded-full inline-block"></span>
              Indexing...
            </span>
          ) : indexError ? (
            <span className="text-red-400" title={indexError}>Error indexing</span>
          ) : (
            <span className="text-green-400 flex items-center gap-1">
              <span className="h-2 w-2 bg-green-400 rounded-full inline-block"></span>
              Ready
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatTab videoId={videoId} />}
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'summary' && <SummaryTab />}
        {activeTab === 'quiz' && <QuizTab />}
        {activeTab === 'flashcards' && <FlashcardsTab />}
      </main>

      {/* Tab Navigation */}
      <nav className="flex justify-around p-3 border-t border-surface bg-surface shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button onClick={() => setActiveTab('chat')} className={`p-2 transition-colors rounded-lg ${activeTab === 'chat' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
          <MessageSquare size={20} />
        </button>
        <button onClick={() => setActiveTab('notes')} className={`p-2 transition-colors rounded-lg ${activeTab === 'notes' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
          <FileText size={20} />
        </button>
        <button onClick={() => setActiveTab('summary')} className={`p-2 transition-colors rounded-lg ${activeTab === 'summary' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
          <AlignLeft size={20} />
        </button>
        <button onClick={() => setActiveTab('quiz')} className={`p-2 transition-colors rounded-lg ${activeTab === 'quiz' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
          <HelpCircle size={20} />
        </button>
        <button onClick={() => setActiveTab('flashcards')} className={`p-2 transition-colors rounded-lg ${activeTab === 'flashcards' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
          <LayoutGrid size={20} />
        </button>
      </nav>
    </div>
  )
}

export default App
