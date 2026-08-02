import { useState, useRef, useEffect } from 'react'
import { Send, User, Bot } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function ChatTab({ videoId }: { videoId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    const asstMsgId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: asstMsgId, role: 'assistant', content: '' }])

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, query: input })
      })

      if (!response.body) throw new Error('No response body')
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      let done = false
      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (value) {
          const chunk = decoder.decode(value, { stream: true })
          setMessages(prev => prev.map(msg => 
            msg.id === asstMsgId ? { ...msg, content: msg.content + chunk } : msg
          ))
        }
      }
    } catch (error) {
      console.error(error)
      setMessages(prev => prev.map(msg => 
        msg.id === asstMsgId ? { ...msg, content: 'Error connecting to Lumora API.' } : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const parseContent = (content: string) => {
    // Look for 📍[MM:SS] tags
    const regex = /📍\[(\d{2}:\d{2})\]/g
    const parts = content.split(regex)
    
    // It splits into [text, "MM:SS", text, "MM:SS", text]
    return parts.map((part, i) => {
      if (i % 2 === 1) { // It's a timestamp
        return (
          <button 
            key={i} 
            className="text-primary font-medium hover:bg-primary/20 transition-colors mx-1 cursor-pointer bg-primary/10 px-1.5 py-0.5 rounded text-[13px] inline-flex items-center ring-1 ring-primary/30"
            onClick={() => {
              const [mins, secs] = part.split(':').map(Number)
              const time = mins * 60 + secs
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
                const tabId = tabs[0]?.id
                if (tabId) {
                  chrome.tabs.sendMessage(tabId, { action: 'seekTo', time })
                }
              })
            }}
          >
            ▶ {part}
          </button>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex flex-col h-full bg-background relative font-sans">
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted text-center p-8 flex-col gap-4">
            <Bot size={48} className="opacity-20" />
            <p className="text-sm">How can I help you understand this video?</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 p-5 ${msg.role === 'user' ? 'bg-transparent' : 'bg-surface/30 border-y border-white/5'}`}>
                <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-[#10A37F] text-white'}`}>
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs text-muted mb-1 uppercase tracking-wide">
                    {msg.role === 'user' ? 'You' : 'Lumora'}
                  </div>
                  <div className="text-text whitespace-pre-wrap text-[15px] leading-relaxed">
                    {parseContent(msg.content)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-12">
        <div className="relative max-w-3xl mx-auto">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message Lumora..." 
            rows={1}
            className="w-full bg-surface border border-gray-600/50 rounded-xl px-4 py-3.5 pr-12 text-[15px] text-text placeholder:text-muted outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-none overflow-hidden"
            style={{ minHeight: '52px', maxHeight: '200px' }}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2.5 p-1.5 rounded-lg bg-primary text-white disabled:bg-surface disabled:text-muted hover:bg-blue-600 transition-colors"
          >
            <Send size={18} className={isLoading ? "animate-pulse" : ""} />
          </button>
        </div>
        <div className="text-center mt-2 text-[10px] text-muted">
          Lumora can make mistakes. Check timestamps.
        </div>
      </div>
    </div>
  )
}
