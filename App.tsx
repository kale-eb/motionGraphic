import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Video, Code2, Eye, Download, Film, Smartphone, Monitor, LayoutTemplate } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import CodeEditor from './components/CodeEditor';
import Preview from './components/Preview';
import Timeline from './components/Timeline';
import { INITIAL_CSS, INITIAL_HTML } from './constants';
import { Message, Sender, CodeState, UpdateCodeArgs } from './types';
import { createChatSession, sendMessageToGemini } from './services/geminiService';
import { updateCssProperty, calculateAnimationDuration } from './utils/cssParser';

function App() {
  // State
  const [code, setCode] = useState<CodeState>({ html: INITIAL_HTML, css: INITIAL_CSS });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Calculate dynamic max time based on animations in CSS
  const maxTime = useMemo(() => {
    return calculateAnimationDuration(code.css);
  }, [code.css]);

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    // Pause when scrubbing
    setIsPlaying(false);
  };

  // Animate playhead when playing
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const deltaTime = (time - lastTime) / 1000; // Convert to seconds
      lastTime = time;

      setCurrentTime(prev => {
        const newTime = prev + deltaTime;
        // Stop at max time
        if (newTime >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return newTime;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, maxTime]);

  // Initialize Chat Session
  useEffect(() => {
    try {
      const session = createChatSession(code);
      setChatSession(session);
    } catch (e) {
      console.error("Failed to init chat", e);
      const errorMessage: Message = {
        id: 'error-init',
        text: 'Could not connect to Gemini. Please ensure a valid API Key is set in your environment.',
        sender: Sender.SYSTEM,
        timestamp: new Date()
      };
      setMessages([errorMessage]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleSendMessage = async (text: string) => {
    if (!chatSession) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: Sender.USER,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsProcessing(true);

    try {
      const responseText = await sendMessageToGemini(
        chatSession,
        text,
        (updates: UpdateCodeArgs) => {
            // Apply code updates
            setCode(prev => ({
                html: updates.html ?? prev.html,
                css: updates.css ?? prev.css
            }));
            // Force switch to preview to see the magic happen
            setViewMode('preview');
            setIsPlaying(true);
        }
      );

      const newAiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: Sender.AI,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newAiMsg]);

    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenderVideo = async () => {
    setIsRendering(true);

    try {
      // Calculate actual animation duration from CSS
      const animationDuration = calculateAnimationDuration(code.css);
      console.log(`Rendering ${animationDuration} seconds of animation`);

      // Call backend render API (uses Puppeteer screencast - simple!)
      const response = await fetch('http://localhost:3001/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: code.html,
          css: code.css,
          duration: animationDuration,
          fps: 30,
          width: orientation === 'landscape' ? 1920 : 1080,
          height: orientation === 'landscape' ? 1080 : 1920
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to render video');
      }

      // Download the video
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'animation.webm';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('Video rendered successfully! Check your downloads folder.');
    } catch (error) {
      console.error('Render error:', error);
      alert(`Failed to render video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRendering(false);
    }
  };

  // Handle updates from visual editor (Timeline or Dragging)
  const updateCss = (newCss: string) => {
      setCode(prev => ({ ...prev, css: newCss }));
  };

  const handleElementDrag = (selector: string, xPercent: number, yPercent: number) => {
      // Update CSS with new positions
      // We enforce absolute positioning and top/left
      // We also RESET transform to 'none' because previous transforms (like translate(-50%, -50%))
      // will conflict with our precise top/left calculation.
      let newCss = code.css;
      newCss = updateCssProperty(newCss, selector, 'position', 'absolute');
      newCss = updateCssProperty(newCss, selector, 'left', `${xPercent.toFixed(2)}%`);
      newCss = updateCssProperty(newCss, selector, 'top', `${yPercent.toFixed(2)}%`);
      newCss = updateCssProperty(newCss, selector, 'margin', '0');
      newCss = updateCssProperty(newCss, selector, 'transform', 'none');
      
      setCode(prev => ({ ...prev, css: newCss }));
  };

  return (
    <div className="flex h-screen bg-black text-gray-100 font-sans overflow-hidden">
      
      {/* Left: Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Toolbar */}
        <header className="h-16 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black font-bold text-lg">M</div>
                <h1 className="font-semibold text-lg tracking-tight">MotionGen</h1>
            </div>

            {/* View Modes & Orientation */}
            <div className="flex items-center gap-4">
                <div className="flex items-center bg-gray-900 rounded-lg p-1 border border-gray-800">
                    <button 
                        onClick={() => setOrientation('landscape')}
                        className={`p-1.5 rounded-md transition-all ${orientation === 'landscape' ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                        title="Landscape"
                    >
                        <Monitor size={18} />
                    </button>
                    <button 
                        onClick={() => setOrientation('portrait')}
                        className={`p-1.5 rounded-md transition-all ${orientation === 'portrait' ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                        title="Portrait"
                    >
                        <Smartphone size={18} />
                    </button>
                </div>

                <div className="flex items-center bg-gray-900 rounded-lg p-1 border border-gray-800">
                    <button 
                        onClick={() => setViewMode('preview')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all ${viewMode === 'preview' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <Eye size={16} /> Preview
                    </button>
                    <button 
                        onClick={() => setViewMode('code')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all ${viewMode === 'code' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <Code2 size={16} /> Code
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3">
               <button
                  onClick={() => {
                    // If clicking play when animation finished, restart from beginning
                    if (!isPlaying && currentTime >= maxTime) {
                      setCurrentTime(0);
                    }
                    setIsPlaying(!isPlaying);
                  }}
                  className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                  title={isPlaying ? "Pause Animation" : "Play Animation"}
               >
                   {isPlaying ? <Pause size={20} /> : <Play size={20} />}
               </button>
               <div className="w-px h-6 bg-gray-800 mx-1"></div>
               <button 
                  onClick={handleRenderVideo}
                  disabled={isRendering}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-70"
               >
                   {isRendering ? (
                       <>Rendering Video...</>
                   ) : (
                       <>
                        <Film size={16} /> Render Video
                       </>
                   )}
               </button>
            </div>
        </header>

        {/* Canvas / Code Area */}
        <main className="flex-1 relative bg-gray-900 overflow-hidden flex flex-col">
            <div className="flex-1 relative overflow-auto flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black">
                {viewMode === 'preview' ? (
                     <Preview
                        html={code.html}
                        css={code.css}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        orientation={orientation}
                        onElementDrag={handleElementDrag}
                    />
                ) : (
                    <div className="w-full h-full flex max-w-7xl mx-auto bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                        <div className="flex-1">
                            <CodeEditor 
                                html={code.html} 
                                css={code.css} 
                                onHtmlChange={(val) => setCode(prev => ({ ...prev, html: val }))}
                                onCssChange={(val) => setCode(prev => ({ ...prev, css: val }))}
                            />
                        </div>
                        {/* Mini Preview in Code Mode */}
                        <div className="w-80 border-l border-gray-800 hidden xl:block bg-black flex flex-col">
                             <div className="p-2 border-b border-gray-800 text-xs font-medium text-gray-500 uppercase tracking-wider">Mini Preview</div>
                             <div className="flex-1 p-4 flex items-center justify-center">
                                <div className="w-full aspect-square">
                                    <Preview 
                                        html={code.html} 
                                        css={code.css} 
                                        isPlaying={isPlaying} 
                                        orientation="landscape"
                                    />
                                </div>
                             </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Timeline Editor (Only visible in Preview mode) */}
            {viewMode === 'preview' && (
                <Timeline
                    css={code.css}
                    onUpdateCss={updateCss}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    maxTime={maxTime}
                />
            )}
        </main>
      </div>

      {/* Right: Chat Sidebar */}
      <ChatInterface 
        messages={messages} 
        onSendMessage={handleSendMessage}
        isProcessing={isProcessing}
      />
    </div>
  );
}

export default App;