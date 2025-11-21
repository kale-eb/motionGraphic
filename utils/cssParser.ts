import { AnimationTrack } from '../types';

// Helper to parse time strings (4s, 400ms) to seconds
const parseTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toLowerCase();
  if (cleaned.endsWith('ms')) return parseFloat(cleaned) / 1000;
  if (cleaned.endsWith('s')) return parseFloat(cleaned);
  // Default to 0 if parsing fails
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Robustly splits CSS into blocks { selector, body }
 * Handles nested braces (media queries, keyframes) by tracking depth.
 */
const extractCssBlocks = (css: string) => {
  const blocks: { selector: string; body: string; fullMatch: string; index: number }[] = [];
  
  // Remove comments for parsing safety, but keep original for replacement index calculation?
  // Actually, for this UI, we can just parse the clean version to find tracks.
  // For updating, we use Regex on the original string.
  
  // Let's do a simple character walk to find top-level rules.
  let depth = 0;
  let buffer = '';
  let selectorBuffer = '';
  let isInsideBlock = false;
  let currentSelectorStartIndex = 0;

  // We need to ignore comments during the walk
  let i = 0;
  while (i < css.length) {
    const char = css[i];
    
    // Handle Comments
    if (char === '/' && css[i+1] === '*') {
      const closeIndex = css.indexOf('*/', i + 2);
      if (closeIndex !== -1) {
        i = closeIndex + 2;
        continue;
      }
    }

    if (char === '{') {
      if (depth === 0) {
        isInsideBlock = true;
        selectorBuffer = buffer.trim();
        buffer = '';
      } else {
        buffer += char;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        isInsideBlock = false;
        blocks.push({
          selector: selectorBuffer,
          body: buffer,
          fullMatch: '', // constructed if needed, but we treat differently here
          index: currentSelectorStartIndex
        });
        buffer = '';
        selectorBuffer = '';
      } else {
        buffer += char;
      }
    } else {
      if (depth === 0) {
         if (buffer === '') currentSelectorStartIndex = i;
         buffer += char;
      } else {
         buffer += char;
      }
    }
    i++;
  }
  return blocks;
};

export const parseAnimationTracks = (css: string): AnimationTrack[] => {
  const tracks: AnimationTrack[] = [];
  const blocks = extractCssBlocks(css);

  blocks.forEach(block => {
    const { selector, body } = block;
    
    // Ignore keyframes and media queries for timeline tracks
    if (selector.startsWith('@')) return;

    // Split comma-separated selectors
    const selectors = selector.split(',').map(s => s.trim());

    // Extract properties
    const animationMatch = /animation:\s*([^;]+)/i.exec(body);
    const animationNameMatch = /animation-name:\s*([^;]+)/i.exec(body);
    const animationDurationMatch = /animation-duration:\s*([^;]+)/i.exec(body);
    const animationDelayMatch = /animation-delay:\s*([^;]+)/i.exec(body);

    let duration = 0;
    let delay = 0;
    let name = '';
    let hasAnimation = false;

    // 1. Parse Shorthand
    if (animationMatch) {
      hasAnimation = true;
      const val = animationMatch[1];
      // Split by space but respect parentheses (cubic-bezier)
      const parts = val.split(/\s+(?![^(]*\))/); 
      
      const times = parts.filter(p => /^\d*\.?\d+(s|ms)$/i.test(p));
      
      if (times.length > 0) duration = parseTime(times[0]);
      if (times.length > 1) delay = parseTime(times[1]);

      // Try to find name (not time, not generic keyword)
      const keywords = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end', 'infinite', 'alternate', 'alternate-reverse', 'reverse', 'forwards', 'backwards', 'both', 'running', 'paused', 'none', 'cubic-bezier'];
      
      const namePart = parts.find(p => {
         if (/^\d*\.?\d+(s|ms)$/i.test(p)) return false;
         if (/^\d+$/.test(p)) return false; // iteration count
         if (p.startsWith('cubic-bezier')) return false;
         if (keywords.includes(p)) return false;
         return true;
      });
      
      if (namePart) name = namePart;
    }

    // 2. Specific properties override shorthand
    if (animationNameMatch) {
        name = animationNameMatch[1].trim();
        hasAnimation = true;
    }
    if (animationDurationMatch) {
        duration = parseTime(animationDurationMatch[1].trim());
        hasAnimation = true;
    }
    if (animationDelayMatch) {
        delay = parseTime(animationDelayMatch[1].trim());
        hasAnimation = true;
    }

    if (hasAnimation && duration > 0) {
      selectors.forEach(sel => {
        // Prevent duplicate tracks for the same selector if CSS has duplicates (take last one usually, but here we push all)
        // We filter out duplicates based on selector name in UI if needed
        tracks.push({ selector: sel, duration, delay, name: name || 'anim' });
      });
    }
  });

  return tracks;
};

// Update a specific property in a CSS rule
export const updateCssProperty = (css: string, selector: string, property: string, value: string): string => {
  // We need to find the rule for this exact selector.
  // A simple Regex is tricky because of spacing and formatting.
  // We will try to find the block using a flexible regex, or append if not found.
  
  const escapedSelector = escapeRegExp(selector);
  
  // Regex: 
  // 1. Start of line or } or whitespace
  // 2. The selector (allowing for whitespace around dots/hashes)
  // 3. Followed immediately by {
  // 4. Capture the body
  
  // This regex allows whitespace between parts of selector if needed, but strictly we assume standard formatting or what we generate.
  // We'll stick to looking for the literal string provided, assuming standard spacing.
  
  // Handle case where selector might have spaces (e.g. ".class1 .class2")
  // We treat the selector string as a literal block header.
  
  const ruleRegex = new RegExp(`(^|[}\\s])(${escapedSelector})\\s*\\{([^}]*)\\}`, 'i');
  const match = css.match(ruleRegex);

  if (match) {
    // Rule exists
    const prefix = match[1];
    const sel = match[2];
    let body = match[3];

    // Check if property exists
    const propRegex = new RegExp(`(${escapeRegExp(property)}\\s*:\\s*)([^;]+)(;?)`, 'i');
    
    if (propRegex.test(body)) {
      body = body.replace(propRegex, `$1${value}$3`);
    } else {
      // Check if body is empty or needs semicolon
      const trimmedBody = body.trim();
      const needsSemi = trimmedBody.length > 0 && !trimmedBody.endsWith(';');
      body = `${trimmedBody}${needsSemi ? ';' : ''}\n  ${property}: ${value};`;
    }

    // Reassemble
    return css.replace(match[0], `${prefix}${sel} {${body}}`);
  } else {
    // Rule doesn't exist, append it.
    // Ensure we don't break the file structure (add newlines)
    return `${css.trimEnd()}\n\n${selector} {\n  ${property}: ${value};\n}`;
  }
};

export const updateAnimationTiming = (css: string, selector: string, duration: number, delay: number): string => {
    let newCss = css;
    newCss = updateCssProperty(newCss, selector, 'animation-duration', `${duration.toFixed(2)}s`);
    newCss = updateCssProperty(newCss, selector, 'animation-delay', `${delay.toFixed(2)}s`);
    return newCss;
};