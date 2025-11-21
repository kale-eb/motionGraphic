import React, { useState } from 'react';
import { Code, FileCode } from 'lucide-react';

interface CodeEditorProps {
  html: string;
  css: string;
  onHtmlChange: (val: string) => void;
  onCssChange: (val: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ html, css, onHtmlChange, onCssChange }) => {
  const [activeTab, setActiveTab] = useState<'html' | 'css'>('html');

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 bg-gray-950">
        <button
          onClick={() => setActiveTab('html')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'html'
              ? 'bg-gray-900 text-blue-400 border-t-2 border-blue-400'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
          }`}
        >
          <Code size={16} /> HTML
        </button>
        <button
          onClick={() => setActiveTab('css')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'css'
              ? 'bg-gray-900 text-pink-400 border-t-2 border-pink-400'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
          }`}
        >
          <FileCode size={16} /> CSS
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative group">
        <textarea
          className="w-full h-full bg-gray-900 p-4 text-sm font-mono text-gray-300 resize-none focus:outline-none leading-relaxed"
          value={activeTab === 'html' ? html : css}
          onChange={(e) => activeTab === 'html' ? onHtmlChange(e.target.value) : onCssChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
        <div className="absolute bottom-2 right-4 text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Editable • {activeTab.toUpperCase()}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;