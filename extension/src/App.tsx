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
      <header className="flex flex-col border-b border-surface/50 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-semibold text-text flex items-center gap-2">
            Lumora Copilot
          </h1>
          <div className="text-xs font-medium bg-surface/50 px-2 py-1 rounded-md">
            {isIndexing ? (
              <span className="text-yellow-400 flex items-center gap-1.5">
                <span className="animate-pulse h-1.5 w-1.5 bg-yellow-400 rounded-full inline-block"></span>
                Indexing...
              </span>
            ) : indexError ? (
              <span className="text-red-400 flex items-center gap-1.5" title={indexError}>
                <span className="h-1.5 w-1.5 bg-red-400 rounded-full inline-block"></span>
                Error
              </span>
            ) : (
              <span className="text-primary flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-primary rounded-full inline-block"></span>
                Ready
              </span>
            )}
          </div>
        </div>

        {/* Top Tab Navigation */}
        <nav className="flex justify-around px-2 pb-2">
          {[
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'notes', icon: FileText, label: 'Notes' },
            { id: 'summary', icon: AlignLeft, label: 'Summary' },
            { id: 'quiz', icon: HelpCircle, label: 'Quiz' },
            { id: 'flashcards', icon: LayoutGrid, label: 'Cards' },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 mx-1 transition-all rounded-md text-[10px] uppercase tracking-wider font-semibold ${
                activeTab === tab.id 
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-white/5' 
                  : 'text-muted hover:text-text hover:bg-surface/30'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' && <ChatTab videoId={videoId} />}
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'summary' && <SummaryTab />}
        {activeTab === 'quiz' && <QuizTab />}
        {activeTab === 'flashcards' && <FlashcardsTab />}
      </main>
    </div>
  )
}

export default App
