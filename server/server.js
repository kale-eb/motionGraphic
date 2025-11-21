import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Render server is running' });
});

// Render endpoint
app.post('/api/render', async (req, res) => {
  const { html, css, duration = 20, fps = 30, width = 1920, height = 1080 } = req.body;

  if (!html || !css) {
    return res.status(400).json({ error: 'HTML and CSS are required' });
  }

  let browser = null;
  let tempDir = null;
  let videoPath = null;

  try {
    // Create temporary directory for frames
    tempDir = await fs.mkdtemp(join(tmpdir(), 'motiongen-'));
    videoPath = join(tempDir, 'output.webm');

    console.log('Starting render process...');
    console.log('Temp directory:', tempDir);

    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    // Create full HTML document
    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
          }
          ${css}
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    await page.setContent(fullHTML);

    // Wait for any fonts or images to load
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Starting video recording...');

    // Start recording using Puppeteer's built-in screen recording
    const recorder = await page.screencast({
      path: videoPath,
      fps,
      scale: 1
    });

    // Let the animation play for the specified duration
    await new Promise(resolve => setTimeout(resolve, duration * 1000));

    // Stop recording
    await recorder.stop();

    console.log('Recording complete, encoding video...');

    // Read the recorded video
    const videoBuffer = await fs.readFile(videoPath);

    // Clean up
    await browser.close();
    browser = null;

    // Send the video file
    res.set({
      'Content-Type': 'video/webm',
      'Content-Disposition': 'attachment; filename="animation.webm"',
      'Content-Length': videoBuffer.length
    });
    res.send(videoBuffer);

    console.log('Video sent successfully');

  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({
      error: 'Failed to render video',
      details: error.message
    });
  } finally {
    // Clean up resources
    if (browser) {
      await browser.close();
    }
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to clean up temp directory:', err);
      }
    }
  }
});

// Alternative endpoint using ffmpeg for better quality
app.post('/api/render-ffmpeg', async (req, res) => {
  const { html, css, duration = 20, fps = 30, width = 1920, height = 1080 } = req.body;

  if (!html || !css) {
    return res.status(400).json({ error: 'HTML and CSS are required' });
  }

  let browser = null;
  let tempDir = null;

  try {
    // Create temporary directory for frames
    tempDir = await fs.mkdtemp(join(tmpdir(), 'motiongen-'));
    const framesDir = join(tempDir, 'frames');
    await fs.mkdir(framesDir);
    const videoPath = join(tempDir, 'output.webm');

    console.log('Starting render process with ffmpeg...');
    console.log('Temp directory:', tempDir);

    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    // Create full HTML document with animation control
    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
          }
          /* Pause all animations by default */
          *, *::before, *::after {
            animation-play-state: paused !important;
          }
          ${css}
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    await page.setContent(fullHTML);
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Capturing frames...');

    const totalFrames = duration * fps;

    for (let frame = 0; frame < totalFrames; frame++) {
      const currentTime = frame / fps;

      // Scrub animations to current time using negative delay
      await page.evaluate((time) => {
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.animationName && style.animationName !== 'none') {
            // Get original delay
            const delayStr = style.animationDelay;
            let originalDelay = 0;
            if (delayStr) {
              if (delayStr.endsWith('ms')) {
                originalDelay = parseFloat(delayStr) / 1000;
              } else if (delayStr.endsWith('s')) {
                originalDelay = parseFloat(delayStr);
              }
            }
            // Set delay to scrub to current time
            const newDelay = originalDelay - time;
            el.style.animationDelay = newDelay + 's';
          }
        });
      }, currentTime);

      // Wait a bit for styles to apply
      await new Promise(resolve => setTimeout(resolve, 50));

      // Capture frame
      const frameNumber = frame.toString().padStart(6, '0');
      await page.screenshot({
        path: join(framesDir, `frame-${frameNumber}.png`),
        type: 'png'
      });

      if (frame % 30 === 0) {
        console.log(`Captured frame ${frame}/${totalFrames}`);
      }
    }

    await browser.close();
    browser = null;

    console.log('All frames captured, encoding with ffmpeg...');

    // Use ffmpeg to encode frames to webm
    const ffmpegProcess = spawn('ffmpeg', [
      '-framerate', fps.toString(),
      '-i', join(framesDir, 'frame-%06d.png'),
      '-c:v', 'libvpx-vp9',
      '-pix_fmt', 'yuva420p',
      '-b:v', '2M',
      '-crf', '30',
      '-y',
      videoPath
    ]);

    let ffmpegError = '';
    ffmpegProcess.stderr.on('data', (data) => {
      ffmpegError += data.toString();
    });

    await new Promise((resolve, reject) => {
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${ffmpegError}`));
        }
      });
      ffmpegProcess.on('error', reject);
    });

    console.log('Encoding complete, sending video...');

    // Read and send the video
    const videoBuffer = await fs.readFile(videoPath);

    res.set({
      'Content-Type': 'video/webm',
      'Content-Disposition': 'attachment; filename="animation.webm"',
      'Content-Length': videoBuffer.length
    });
    res.send(videoBuffer);

    console.log('Video sent successfully');

  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({
      error: 'Failed to render video',
      details: error.message
    });
  } finally {
    // Clean up resources
    if (browser) {
      await browser.close();
    }
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to clean up temp directory:', err);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`🎥 Render server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
