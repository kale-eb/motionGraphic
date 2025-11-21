import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { parseAnimationTracks, updateAnimationTiming } from '../utils/cssParser';

interface TimelineProps {
  css: string;
  onUpdateCss: (newCss: string) => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
  maxTime?: number;
}

const Timeline: React.FC<TimelineProps> = ({ css, onUpdateCss, currentTime = 0, onSeek, maxTime = 20 }) => {
  const tracks = useMemo(() => parseAnimationTracks(css), [css]);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Scale: 1 second = 100px
  const PX_PER_SEC = 100;
  const MAX_TIME = maxTime;

  // Auto-scroll to keep playhead in view when playing (but not when user is dragging)
  useEffect(() => {
    if (!isDraggingPlayhead && timelineScrollRef.current) {
      const scrollContainer = timelineScrollRef.current;
      const playheadPosition = currentTime * PX_PER_SEC;
      const containerWidth = scrollContainer.clientWidth;
      const scrollLeft = scrollContainer.scrollLeft;

      // Check if playhead is outside the visible area
      if (playheadPosition < scrollLeft || playheadPosition > scrollLeft + containerWidth - 100) {
        // Scroll to center the playhead
        scrollContainer.scrollTo({
          left: playheadPosition - containerWidth / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [currentTime, isDraggingPlayhead]); 

  const handleMouseDown = (e: React.MouseEvent, trackIndex: number, type: 'move' | 'resize') => {
      e.preventDefault();
      e.stopPropagation();
      
      const track = tracks[trackIndex];
      const startX = e.clientX;
      const startDelay = track.delay;
      const startDuration = track.duration;

      const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          const deltaX = moveEvent.clientX - startX;
          const deltaSeconds = deltaX / PX_PER_SEC;

          let newDelay = startDelay;
          let newDuration = startDuration;

          if (type === 'move') {
              newDelay = Math.max(0, startDelay + deltaSeconds);
          } else {
              newDuration = Math.max(0.1, startDuration + deltaSeconds);
          }

          const newCss = updateAnimationTiming(css, track.selector, newDuration, newDelay);
          onUpdateCss(newCss);
      };

      const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
  };

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingPlayhead(true);

      const timelineRect = e.currentTarget.parentElement?.getBoundingClientRect();
      if (!timelineRect) return;

      const updatePlayhead = (clientX: number) => {
          const offsetX = clientX - timelineRect.left;
          const newTime = Math.max(0, Math.min(MAX_TIME, offsetX / PX_PER_SEC));
          if (onSeek) {
              onSeek(newTime);
          }
      };

      // Update immediately on click
      updatePlayhead(e.clientX);

      const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          updatePlayhead(moveEvent.clientX);
      };

      const onMouseUp = () => {
          setIsDraggingPlayhead(false);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="h-64 bg-gray-950 border-t border-gray-800 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] z-10 select-none">
      {/* Header */}
      <div className="h-10 border-b border-gray-800 px-4 flex items-center justify-between text-xs font-medium text-gray-400 bg-gray-900">
        <div className="flex items-center gap-2">
            <Clock size={14} /> 
            <span>Animation Timeline</span>
        </div>
        <span className="text-gray-600">Drag bars to delay • Drag edge to resize duration</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar / Track Names */}
        <div className="w-48 border-r border-gray-800 bg-gray-900 flex-shrink-0 overflow-y-auto custom-scrollbar pb-4">
          {tracks.map((track, i) => (
             <div key={i} className="h-12 border-b border-gray-800 flex items-center px-4 text-xs text-gray-300 truncate hover:bg-gray-800 transition-colors relative group" title={track.selector}>
                 <span className="font-mono text-blue-400 mr-2">#</span>
                 <span className="truncate">{track.selector}</span>
                 <span className="absolute right-2 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100">{track.name}</span>
             </div>
          ))}
          {tracks.length === 0 && (
            <div className="p-4 text-center text-gray-600 text-xs italic">No animated elements</div>
          )}
        </div>

        {/* Timeline Area */}
        <div ref={timelineScrollRef} className="flex-1 relative overflow-x-auto overflow-y-auto bg-gray-950/50 custom-scrollbar">
           {/* Time Markers */}
           <div className="absolute top-0 left-0 h-full pointer-events-none z-0" style={{ width: `${MAX_TIME * PX_PER_SEC}px` }}>
               {Array.from({ length: MAX_TIME + 1 }).map((_, i) => (
                   <div key={i} className="absolute top-0 bottom-0 border-l border-gray-800/30 text-[10px] text-gray-600 pl-1 pt-1 select-none" style={{ left: `${i * PX_PER_SEC}px`}}>
                       {i}s
                   </div>
               ))}
           </div>

           {/* Playhead */}
           <div
               className="absolute top-0 bottom-0 z-30 cursor-ew-resize group"
               style={{ left: `${currentTime * PX_PER_SEC}px` }}
               onMouseDown={handlePlayheadMouseDown}
           >
               {/* Playhead Line */}
               <div className="absolute inset-y-0 w-0.5 bg-red-500 group-hover:bg-red-400 transition-colors"></div>
               {/* Playhead Head (triangle) */}
               <div className="absolute -top-1 -left-2 w-4 h-4 rotate-45 transform origin-center bg-red-500 group-hover:bg-red-400 transition-colors" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
               {/* Time Label */}
               <div className="absolute -top-6 -left-6 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                   {currentTime.toFixed(2)}s
               </div>
           </div>

           {/* Track Bars */}
           <div className="relative z-10 min-w-max pb-4">
               {tracks.map((track, i) => (
                   <div key={i} className="h-12 border-b border-gray-800/30 relative w-full">
                       <div 
                           className="absolute top-2 h-8 bg-blue-600/40 hover:bg-blue-600/60 border-l-2 border-r-2 border-blue-500 rounded cursor-move flex items-center group overflow-visible transition-colors"
                           style={{
                               left: `${track.delay * PX_PER_SEC}px`,
                               width: `${Math.max(10, track.duration * PX_PER_SEC)}px`
                           }}
                           onMouseDown={(e) => handleMouseDown(e, i, 'move')}
                       >
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                               <span className="text-[10px] text-white font-mono bg-black/50 px-1 rounded backdrop-blur-sm">
                                   {(track.duration + track.delay).toFixed(1)}s
                               </span>
                           </div>
                           
                           {/* Resize Handle */}
                           <div 
                              className="w-4 h-full absolute -right-2 top-0 cursor-e-resize z-20 flex items-center justify-center group/handle"
                              onMouseDown={(e) => handleMouseDown(e, i, 'resize')}
                           >
                               <div className="w-1.5 h-4 bg-white/50 rounded-full group-hover/handle:bg-white shadow-sm" />
                           </div>
                       </div>
                   </div>
               ))}
               
               {tracks.length === 0 && (
                   <div className="p-12 flex flex-col items-center justify-center text-gray-600 text-sm">
                       <AlertCircle size={32} className="mb-2 opacity-50" />
                       <p>No animations detected.</p>
                       <p className="text-xs opacity-60 mt-2 max-w-xs text-center">
                           Add specific CSS classes with <code className="bg-gray-900 px-1 rounded">animation</code> properties to see them here.
                       </p>
                   </div>
               )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;