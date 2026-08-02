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
            className="text-primary font-medium hover:underline mx-1 cursor-pointer bg-primary/10 px-1 rounded inline-flex items-center"
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
            📍{part}
          </button>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-20">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted text-center p-8 flex-col gap-4">
            <Bot size={48} className="opacity-20" />
            <p>Ask a question about the video.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${msg.role === 'user' ? 'bg-primary shadow-primary/30' : 'bg-surface border border-gray-700'}`}>
                  {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-primary" />}
                </div>
                <div className={`p-3 rounded-2xl max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-sm shadow-lg shadow-primary/20' 
                    : 'bg-surface text-text rounded-tl-sm shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2)] border border-gray-700/50'
                }`}>
                  {parseContent(msg.content)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-10">
        <div className="flex items-center gap-2 bg-surface border border-gray-700 rounded-full p-2 shadow-xl focus-within:border-primary transition-colors">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Lumora..." 
            className="flex-1 bg-transparent border-none outline-none text-text px-3 placeholder:text-muted text-sm"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-full bg-primary text-white disabled:opacity-50 hover:bg-blue-600 transition-colors shadow-lg shadow-primary/30"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
