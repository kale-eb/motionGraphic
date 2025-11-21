import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

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

// Remotion render endpoint
app.post('/api/render-remotion', async (req, res) => {
  const { html, css, duration = 20, fps = 30, width = 1920, height = 1080 } = req.body;

  if (!html || !css) {
    return res.status(400).json({ error: 'HTML and CSS are required' });
  }

  let tempDir = null;
  let bundleLocation = null;

  try {
    console.log('Starting Remotion render...');

    // Create temporary directory
    tempDir = await fs.mkdtemp(join(tmpdir(), 'remotion-'));
    const outputPath = join(tempDir, 'output.webm');

    // Create a temporary composition file with the HTML/CSS
    const compositionPath = join(tempDir, 'TempComposition.jsx');
    const compositionCode = `
import React from 'react';
import { AbsoluteFill } from 'remotion';

export const HTMLAnimation = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <style dangerouslySetInnerHTML={{ __html: \`${css.replace(/`/g, '\\`')}\` }} />
      <div dangerouslySetInnerHTML={{ __html: \`${html.replace(/`/g, '\\`')}\` }} />
    </AbsoluteFill>
  );
};
`;

    const indexPath = join(tempDir, 'index.jsx');
    const indexCode = `
import React from 'react';
import { Composition } from 'remotion';
import { HTMLAnimation } from './TempComposition';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="HTMLAnimation"
        component={HTMLAnimation}
        durationInFrames={${Math.ceil(duration * fps)}}
        fps={${fps}}
        width={${width}}
        height={${height}}
      />
    </>
  );
};
`;

    await fs.writeFile(compositionPath, compositionCode);
    await fs.writeFile(indexPath, indexCode);

    console.log('Bundling Remotion composition...');

    // Bundle the composition
    bundleLocation = await bundle({
      entryPoint: indexPath,
      onProgress: (progress) => {
        console.log(`Bundling: ${Math.round(progress * 100)}%`);
      },
    });

    console.log('Rendering video...');

    // Render the video
    await renderMedia({
      composition: {
        id: 'HTMLAnimation',
        durationInFrames: Math.ceil(duration * fps),
        fps,
        width,
        height,
      },
      serveUrl: bundleLocation,
      codec: 'vp9',
      outputLocation: outputPath,
      onProgress: ({ progress }) => {
        console.log(`Rendering: ${Math.round(progress * 100)}%`);
      },
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
      pixelFormat: 'yuva420p', // Preserve alpha channel
    });

    console.log('Render complete, sending file...');

    // Read and send the video
    const videoBuffer = await fs.readFile(outputPath);

    res.set({
      'Content-Type': 'video/webm',
      'Content-Disposition': 'attachment; filename="animation.webm"',
      'Content-Length': videoBuffer.length
    });
    res.send(videoBuffer);

    console.log('Video sent successfully');

  } catch (error) {
    console.error('Remotion render error:', error);
    res.status(500).json({
      error: 'Failed to render video',
      details: error.message,
      stack: error.stack
    });
  } finally {
    // Clean up
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
