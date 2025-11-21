import React from 'react';
import { AbsoluteFill } from 'remotion';

export const HTMLAnimation = ({ html, css, width, height }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        width: width,
        height: height,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </AbsoluteFill>
  );
};
