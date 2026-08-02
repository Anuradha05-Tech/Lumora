import { useState, useEffect } from 'react';
import { Loader2, FileText, Copy, Download, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function NotesTab({ videoId }: { videoId: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/generate/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate notes');
        setContent(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContent();
  }, [videoId]);

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMD = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lumora_Notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Lumora Notes</title>
            <style>
              body { font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
              h1, h2, h3 { color: #111; }
              pre { background: #f4f4f4; padding: 15px; border-radius: 8px; }
              code { background: #f4f4f4; padding: 2px 5px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <!-- We just dump the raw text with pre-wrap for now, or render markdown to HTML -->
            <div style="white-space: pre-wrap;">${content}</div>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="h-full flex flex-col relative bg-background">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-white/5 bg-surface/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-primary font-medium text-[14px]">
          <FileText size={16} /> Structured Notes
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy}
            className="p-1.5 text-muted hover:text-text hover:bg-surface rounded-md transition-colors border border-transparent hover:border-white/5"
            title="Copy to Clipboard"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
          <button 
            onClick={downloadMD}
            className="p-1.5 text-muted hover:text-text hover:bg-surface rounded-md transition-colors border border-transparent hover:border-white/5"
            title="Download Markdown"
          >
            <Download size={16} />
          </button>
          <button 
            onClick={handlePrintPDF}
            className="px-3 py-1.5 text-[12px] font-medium bg-surface border border-white/10 hover:border-primary/50 hover:text-primary rounded-md transition-colors"
          >
            Save PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 print-container">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-[13px]">Structuring comprehensive notes...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-red-400 text-[13px] text-center mt-10 bg-red-500/10 rounded-xl border border-red-500/20">
            Error: {error}
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none text-[14px] leading-relaxed text-text">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
