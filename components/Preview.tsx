import React, { useEffect, useRef } from 'react';

interface PreviewProps {
  html: string;
  css: string;
  isPlaying: boolean;
  orientation: 'landscape' | 'portrait';
  onElementDrag?: (selector: string, xPercent: number, yPercent: number) => void;
}

const Preview: React.FC<PreviewProps> = ({ html, css, isPlaying, orientation, onElementDrag }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only update parent state when drag ENDS to prevent re-render loop
      if (event.data.type === 'ELEMENT_DRAG_END') {
        if (onElementDrag) {
          onElementDrag(event.data.selector, event.data.x, event.data.y);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementDrag]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              /* Reset */
              * { box-sizing: border-box; }
              body { 
                margin: 0; 
                overflow: hidden; 
                width: 100vw; 
                height: 100vh;
                /* Prevent default touch actions to help with drag */
                touch-action: none;
                /* CRITICAL: Disable text selection so text is draggable */
                user-select: none;
                -webkit-user-select: none;
              }
              
              /* UI for interactivity */
              .interactive-hover {
                 outline: 2px dashed #3b82f6;
                 cursor: grab !important; /* Force grab cursor over text */
                 z-index: 10000;
                 position: relative; 
              }
              .interactive-active {
                 outline: 2px solid #3b82f6;
                 cursor: grabbing !important;
                 z-index: 10000;
              }

              /* User CSS */
              ${css}
              
              /* Animation Control */
              ${!isPlaying ? `*, *::before, *::after { animation-play-state: paused !important; }` : ''}
            </style>
          </head>
          <body>
            ${html}
            <script>
              let dragData = {
                el: null,
                selector: null,
                shiftX: 0,
                shiftY: 0
              };

              // Helper to generate a specific CSS selector
              function getUniqueSelector(el) {
                 if (!el) return null;
                 if (el.id) return '#' + el.id;
                 
                 let selector = '';
                 
                 // 1. Try class based selector
                 if (el.className && typeof el.className === 'string') {
                     const classes = el.className.split(/\\s+/)
                         .filter(c => c && c !== 'interactive-hover' && c !== 'interactive-active');
                     
                     if (classes.length > 0) {
                         // Join all classes for specificity (.class1.class2)
                         selector = '.' + classes.join('.');
                     }
                 }
                 
                 // 2. Fallback to tag name
                 if (!selector) {
                     selector = el.tagName.toLowerCase();
                 }
                 
                 // 3. Add :nth-child if there are siblings that would match this selector
                 const parent = el.parentElement;
                 if (parent) {
                     const siblings = Array.from(parent.children);
                     const matches = siblings.filter(sib => {
                         if (sib === el) return true;
                         if (sib.tagName.toLowerCase() !== el.tagName.toLowerCase()) return false;
                         if (selector.startsWith('.')) {
                             const myClasses = selector.substring(1).split('.');
                             return myClasses.every(cls => sib.classList.contains(cls));
                         }
                         return true; 
                     });
                     
                     if (matches.length > 1) {
                         const index = siblings.indexOf(el) + 1;
                         selector += ':nth-child(' + index + ')';
                     }
                 }
                 
                 return selector;
              }

              document.body.addEventListener('mouseover', (e) => {
                 if (dragData.el) return;
                 let target = e.target;
                 if (target === document.body || target === document.documentElement) return;
                 
                 target.classList.add('interactive-hover');
              });

              document.body.addEventListener('mouseout', (e) => {
                 if (dragData.el) return; // Don't remove hover if dragging
                 let target = e.target;
                 if (target) target.classList.remove('interactive-hover');
              });

              document.body.addEventListener('mousedown', (e) => {
                 let target = e.target;
                 // Prevent default to stop image ghosting / text selection
                 e.preventDefault();
                 
                 if (target === document.body || target === document.documentElement) return;

                 // Calculate offset to prevent snapping to center
                 const rect = target.getBoundingClientRect();
                 const shiftX = e.clientX - rect.left;
                 const shiftY = e.clientY - rect.top;

                 dragData = {
                   el: target,
                   selector: getUniqueSelector(target),
                   shiftX,
                   shiftY
                 };
                 
                 target.classList.remove('interactive-hover');
                 target.classList.add('interactive-active');
                 
                 // Freeze width/height to prevent collapse when switching to absolute
                 // We use computed style to get accurate dimensions including padding
                 const computed = window.getComputedStyle(target);
                 target.style.width = rect.width + 'px';
                 target.style.height = rect.height + 'px';
                 
                 // Switch to absolute positioning immediately for drag
                 target.style.position = 'absolute';
                 target.style.left = rect.left + 'px';
                 target.style.top = rect.top + 'px';
                 target.style.margin = '0';
                 // Remove transforms that might offset position during drag (we'll reset them in CSS later)
                 target.style.transform = 'none';
              });

              window.addEventListener('mousemove', (e) => {
                 if (dragData.el) {
                     e.preventDefault();
                     
                     // Move element locally (high performance, no react render)
                     const newX = e.clientX - dragData.shiftX;
                     const newY = e.clientY - dragData.shiftY;
                     
                     dragData.el.style.left = newX + 'px';
                     dragData.el.style.top = newY + 'px';
                 }
              });

              window.addEventListener('mouseup', () => {
                  if (dragData.el) {
                      const el = dragData.el;
                      el.classList.remove('interactive-active');
                      el.classList.add('interactive-hover');
                      
                      // Calculate final percentages relative to viewport
                      const rect = el.getBoundingClientRect();
                      const winW = window.innerWidth;
                      const winH = window.innerHeight;
                      
                      const xPercent = (rect.left / winW) * 100;
                      const yPercent = (rect.top / winH) * 100;

                      // Only send message at the END of drag to prevent re-render loops
                      window.parent.postMessage({
                          type: 'ELEMENT_DRAG_END',
                          selector: dragData.selector,
                          x: xPercent,
                          y: yPercent
                      }, '*');

                      dragData = { el: null, selector: null, shiftX: 0, shiftY: 0 };
                  }
              });
              
              document.addEventListener('dragstart', (e) => e.preventDefault());
            </script>
          </body>
        </html>
      `);
      doc.close();
    }
  }, [html, css, isPlaying]);

  return (
    <div className={`transition-all duration-300 bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800 mx-auto relative ${
        orientation === 'landscape' ? 'aspect-video w-full' : 'aspect-[9/16] h-full'
    }`}>
      <iframe
        ref={iframeRef}
        title="Preview"
        className="w-full h-full border-0 bg-black"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
      />
      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none select-none z-20">
         Drag elements to move • Edit timeline below
      </div>
    </div>
  );
};

export default Preview;