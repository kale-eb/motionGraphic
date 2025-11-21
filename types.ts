
export enum Sender {
  USER = 'user',
  AI = 'ai',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
}

export interface CodeState {
  html: string;
  css: string;
}

export interface UpdateCodeArgs {
  html?: string;
  css?: string;
  explanation?: string;
}

export interface AnimationTrack {
  selector: string;
  duration: number; // in seconds
  delay: number; // in seconds
  name: string;
}

export interface ElementPosition {
  selector: string;
  top: string;
  left: string;
}
