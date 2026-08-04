import { useState, useEffect } from 'react'
import { MessageSquare, FileText, AlignLeft, HelpCircle, LayoutGrid, Clock } from 'lucide-react'
import ChatTab from './components/ChatTab'
import SummaryTab from './components/SummaryTab'
import NotesTab from './components/NotesTab'
import QuizTab from './components/QuizTab'
import FlashcardsTab from './components/FlashcardsTab'
import TimelineTab from './components/TimelineTab'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [videoMeta, setVideoMeta] = useState<{title: string, author_name: string} | null>(null)
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
        // Fetch metadata via oEmbed
        try {
          const metaRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
          if (metaRes.ok) {
            const metaData = await metaRes.json()
            setVideoMeta({ title: metaData.title, author_name: metaData.author_name })
          }
        } catch (e) {
          console.warn('Could not fetch video metadata', e)
        }

        const res = await fetch('http://localhost:8000/api/process_video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId })
        })
        if (!res.ok) throw new Error('Failed to index video')
        const data = await res.json()
        const jobId = data.job_id
        
        // Poll status
        if (jobId) {
          while (true) {
            const statusRes = await fetch(`http://localhost:8000/api/status/${jobId}`)
            if (statusRes.ok) {
              const statusData = await statusRes.json()
              if (statusData.status === 'done') break
              if (statusData.status === 'failed') throw new Error('Video processing failed')
            }
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
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
      <header className="flex flex-col border-b border-surface/50 shadow-sm bg-surface/20">
        <div className="flex flex-col p-4 gap-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-[13px] font-semibold text-text leading-tight line-clamp-2" title={videoMeta?.title || 'Current Video'}>
                {videoMeta?.title || 'Current Video'}
              </h1>
              <span className="text-[11px] text-muted mt-1">{videoMeta?.author_name || 'YouTube'}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium bg-surface/50 px-2.5 py-1 rounded-md border border-white/5 flex items-center gap-1.5">
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
            <div className="text-[10px] text-muted font-medium uppercase tracking-wider">Lumora</div>
          </div>
        </div>

        {/* Top Tab Navigation */}
        <nav className="flex justify-around px-2 pb-2">
          {[
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'notes', icon: FileText, label: 'Notes' },
            { id: 'summary', icon: AlignLeft, label: 'Summary' },
            { id: 'quiz', icon: HelpCircle, label: 'Quiz' },
            { id: 'timeline', icon: Clock, label: 'Timeline' },
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
        {activeTab === 'notes' && <NotesTab videoId={videoId} />}
        {activeTab === 'summary' && <SummaryTab videoId={videoId} />}
        {activeTab === 'quiz' && <QuizTab videoId={videoId} />}
        {activeTab === 'timeline' && <TimelineTab videoId={videoId} />}
        {activeTab === 'flashcards' && <FlashcardsTab videoId={videoId} />}
      </main>
    </div>
  )
}

export default App
