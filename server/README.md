# MotionGen Render Server

Backend server for rendering motion graphics animations to video using Puppeteer and FFmpeg.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **FFmpeg** installed and available in PATH
   - macOS: `brew install ffmpeg`
   - Ubuntu/Debian: `sudo apt install ffmpeg`
   - Windows: Download from https://ffmpeg.org/download.html

## Installation

```bash
npm install
```

## Running the Server

### Development (Frontend + Backend)
```bash
npm run dev:all
```

This runs both the Vite dev server (port 5173) and the render server (port 3001) concurrently.

### Backend Only
```bash
npm run server
```

### Frontend Only
```bash
npm run dev
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status.

### Render Video (Puppeteer)
```
POST /api/render
```

Faster rendering using Puppeteer's built-in screen recording. May have quality limitations.

**Request Body:**
```json
{
  "html": "<div>...</div>",
  "css": "body { ... }",
  "duration": 20,
  "fps": 30,
  "width": 1920,
  "height": 1080
}
```

### Render Video (FFmpeg)
```
POST /api/render-ffmpeg
```

High-quality rendering by capturing individual frames and encoding with FFmpeg. Slower but better quality.

**Request Body:**
```json
{
  "html": "<div>...</div>",
  "css": "body { ... }",
  "duration": 20,
  "fps": 30,
  "width": 1920,
  "height": 1080
}
```

**Response:**
- Content-Type: `video/webm`
- Binary video file

## How It Works

### /api/render (Puppeteer)
1. Launches headless Chrome browser
2. Injects HTML/CSS
3. Records screen for specified duration
4. Returns WebM video

### /api/render-ffmpeg (Frame-based)
1. Launches headless Chrome browser
2. Injects HTML/CSS with paused animations
3. Captures PNG frame for each time step
4. Scrubs animations using negative `animation-delay`
5. Encodes frames to WebM using FFmpeg VP9 codec
6. Returns video file

## Configuration

Default settings:
- Port: 3001
- Video format: WebM (VP9 codec with alpha support)
- Default duration: 20 seconds
- Default FPS: 30
- Default resolution: 1920x1080

## Troubleshooting

### FFmpeg not found
Ensure FFmpeg is installed and available in your PATH:
```bash
ffmpeg -version
```

### Puppeteer Chrome download issues
If Puppeteer fails to download Chrome:
```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false npm install puppeteer
```

### Out of memory errors
For long or high-resolution videos, increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run server
```

## Performance Notes

- **Puppeteer mode**: ~2-5 seconds for 20-second video
- **FFmpeg mode**: ~30-60 seconds for 20-second video at 30fps (600 frames)
- Memory usage scales with resolution and FPS
- Temporary files are cleaned up automatically
