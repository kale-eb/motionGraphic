import { registerRoot } from 'remotion';
import { HTMLAnimation } from './Composition';

export const RemotionRoot = () => {
  return null; // Root is registered dynamically
};

registerRoot(RemotionRoot);

export { HTMLAnimation };
