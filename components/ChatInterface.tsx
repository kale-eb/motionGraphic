import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { Message, Sender } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isProcessing }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-800 w-96 shadow-xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 bg-gray-950 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
           <Sparkles size={20} className="text-white" />
        </div>
        <div>
            <h2 className="font-bold text-gray-100">Gemini 3 Pro</h2>
            <p className="text-xs text-gray-500">Motion Graphics Assistant</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-4 opacity-60">
                <Bot size={48} />
                <p className="text-center text-sm px-8">
                    Ask me to change the colors, speed up the animation, or create a completely new scene!
                </p>
            </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === Sender.USER ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.sender === Sender.USER ? 'bg-gray-700' : 'bg-gradient-to-br from-blue-600 to-purple-600'
              }`}
            >
              {msg.sender === Sender.USER ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                msg.sender === Sender.USER
                  ? 'bg-gray-800 text-gray-100 rounded-tr-none'
                  : 'bg-gray-900/50 text-gray-300 border border-gray-800 rounded-tl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <Bot size={14} />
             </div>
             <div className="bg-gray-900/50 p-3 rounded-2xl rounded-tl-none border border-gray-800 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span className="text-xs text-gray-400">Generating changes...</span>
             </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 bg-gray-950">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your animation..."
            className="w-full bg-gray-900 text-gray-100 pl-4 pr-12 py-3 rounded-xl border border-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm placeholder-gray-600 transition-all"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;