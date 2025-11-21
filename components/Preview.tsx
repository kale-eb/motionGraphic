import React, { useEffect, useRef } from 'react';
import { forceNonLoopingAnimations } from '../utils/cssParser';

interface PreviewProps {
  html: string;
  css: string;
  isPlaying: boolean;
  currentTime: number;
  orientation: 'landscape' | 'portrait';
  onElementDrag?: (selector: string, xPercent: number, yPercent: number) => void;
}

const Preview: React.FC<PreviewProps> = ({ html, css, isPlaying, currentTime, orientation, onElementDrag }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Process CSS to force non-looping animations
  const processedCss = forceNonLoopingAnimations(css);

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

  // Handle scrubbing when currentTime changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    // Send scrub command to iframe
    iframe.contentWindow.postMessage({
      type: 'SCRUB',
      time: currentTime
    }, '*');
  }, [currentTime]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    // Check if iframe is already initialized
    const existingStyleTag = doc.getElementById('user-css');
    const existingAnimationControl = doc.getElementById('animation-control');

    if (existingStyleTag && existingAnimationControl) {
      // Iframe already exists - just update the CSS without rewriting
      existingStyleTag.textContent = processedCss;
      existingAnimationControl.textContent = !isPlaying ? `*, *::before, *::after { animation-play-state: paused !important; }` : '';
      return;
    }

    // Initial render - write the full iframe
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
                 cursor: grab !important;
                 z-index: 10000;
                 position: relative;
              }
              .interactive-hover-disabled {
                 outline: 2px dashed #ef4444;
                 cursor: not-allowed !important;
                 z-index: 10000;
                 position: relative;
              }
              .interactive-active {
                 outline: 2px solid #3b82f6;
                 cursor: grabbing !important;
                 z-index: 10000;
              }

              /* Tooltip for when animations are playing */
              .drag-tooltip {
                position: fixed;
                background: rgba(0, 0, 0, 0.9);
                color: #fbbf24;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                pointer-events: none;
                z-index: 100000;
                white-space: nowrap;
                border: 1px solid #fbbf24;
              }
            </style>
            <!-- User CSS (updatable) -->
            <style id="user-css">
              ${processedCss}
            </style>
            <!-- Animation Control (updatable) -->
            <style id="animation-control">
              ${!isPlaying ? `*, *::before, *::after { animation-play-state: paused !important; }` : ''}
            </style>
          </head>
          <body>
            ${html}
            <script>
              // Helper to check if animations are currently playing
              function areAnimationsPlaying() {
                // Check if the animation-control style is active (pausing animations)
                const animControlStyle = document.getElementById('animation-control');
                return !animControlStyle || animControlStyle.textContent.trim() === '';
              }

              // Listen for scrub messages from parent
              window.addEventListener('message', (event) => {
                if (event.data.type === 'SCRUB') {
                  const time = event.data.time;

                  // Find all animated elements
                  const elements = document.querySelectorAll('*');
                  elements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (style.animationName && style.animationName !== 'none') {
                      // Scrub by setting animation-delay to negative value
                      // This makes the animation jump to that point
                      el.style.animationDelay = '-' + time + 's';
                    }
                  });
                }
              });

              let dragData = {
                el: null,
                selector: null,
                startX: 0,
                startY: 0,
                elementStartX: 0,
                elementStartY: 0
              };
              let tooltip = null;

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

                 if (areAnimationsPlaying()) {
                   // Animation is playing - show disabled state and tooltip
                   target.classList.add('interactive-hover-disabled');

                   // Create tooltip
                   if (!tooltip) {
                     tooltip = document.createElement('div');
                     tooltip.className = 'drag-tooltip';
                     tooltip.textContent = '⏸ Pause animation to move elements';
                     document.body.appendChild(tooltip);
                   }

                   // Position tooltip near cursor
                   const rect = target.getBoundingClientRect();
                   tooltip.style.left = rect.left + 'px';
                   tooltip.style.top = (rect.bottom + 10) + 'px';
                 } else {
                   // Animation is paused - allow dragging
                   target.classList.add('interactive-hover');
                 }
              });

              document.body.addEventListener('mouseout', (e) => {
                 if (dragData.el) return;
                 let target = e.target;
                 if (target) {
                   target.classList.remove('interactive-hover');
                   target.classList.remove('interactive-hover-disabled');
                 }

                 // Remove tooltip
                 if (tooltip) {
                   tooltip.remove();
                   tooltip = null;
                 }
              });

              document.body.addEventListener('mousedown', (e) => {
                 let target = e.target;

                 if (target === document.body || target === document.documentElement) return;

                 // BLOCK dragging if animation is playing
                 if (areAnimationsPlaying()) {
                   e.preventDefault();
                   return;
                 }

                 // Prevent default to stop image ghosting / text selection
                 e.preventDefault();

                 // Get current position
                 const rect = target.getBoundingClientRect();
                 const offsetParent = target.offsetParent || document.body;
                 const parentRect = offsetParent.getBoundingClientRect();

                 // Store initial mouse position and element position
                 dragData = {
                   el: target,
                   selector: getUniqueSelector(target),
                   startX: e.clientX,
                   startY: e.clientY,
                   elementStartX: rect.left,
                   elementStartY: rect.top
                 };

                 target.classList.remove('interactive-hover');
                 target.classList.add('interactive-active');

                 // Convert to absolute positioning at current location
                 const relativeLeft = rect.left - parentRect.left;
                 const relativeTop = rect.top - parentRect.top;

                 target.style.position = 'absolute';
                 target.style.left = relativeLeft + 'px';
                 target.style.top = relativeTop + 'px';
                 target.style.margin = '0';
                 target.style.transform = 'none';
              });

              window.addEventListener('mousemove', (e) => {
                 if (dragData.el) {
                     e.preventDefault();

                     // Calculate drag offset from start position
                     const deltaX = e.clientX - dragData.startX;
                     const deltaY = e.clientY - dragData.startY;

                     // Calculate new position
                     const offsetParent = dragData.el.offsetParent || document.body;
                     const parentRect = offsetParent.getBoundingClientRect();

                     const newX = dragData.elementStartX + deltaX - parentRect.left;
                     const newY = dragData.elementStartY + deltaY - parentRect.top;

                     // Update position directly
                     dragData.el.style.left = newX + 'px';
                     dragData.el.style.top = newY + 'px';
                 }
              });

              window.addEventListener('mouseup', (e) => {
                  if (dragData.el) {
                      const el = dragData.el;
                      el.classList.remove('interactive-active');
                      el.classList.add('interactive-hover');

                      // Calculate final position after drag
                      const deltaX = e.clientX - dragData.startX;
                      const deltaY = e.clientY - dragData.startY;

                      const finalX = dragData.elementStartX + deltaX;
                      const finalY = dragData.elementStartY + deltaY;

                      // Calculate percentages relative to the containing block
                      const offsetParent = el.offsetParent || document.body;
                      const parentRect = offsetParent.getBoundingClientRect();

                      const relativeLeft = finalX - parentRect.left;
                      const relativeTop = finalY - parentRect.top;

                      const xPercent = (relativeLeft / parentRect.width) * 100;
                      const yPercent = (relativeTop / parentRect.height) * 100;

                      // Clear the transform we added during drag
                      el.style.transform = '';
                      delete el.dataset.originalTransform;

                      // Send message to update CSS
                      window.parent.postMessage({
                          type: 'ELEMENT_DRAG_END',
                          selector: dragData.selector,
                          x: xPercent,
                          y: yPercent
                      }, '*');

                      dragData = { el: null, selector: null, startX: 0, startY: 0, elementStartX: 0, elementStartY: 0 };
                  }
              });
              
              document.addEventListener('dragstart', (e) => e.preventDefault());
            </script>
          </body>
        </html>
      `);
      doc.close();
    }
  }, [html, processedCss, isPlaying, currentTime]);

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