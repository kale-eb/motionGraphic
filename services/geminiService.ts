import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { CodeState, UpdateCodeArgs } from "../types";

// Define the tool for updating code
const updateCodeTool: FunctionDeclaration = {
  name: 'updateCode',
  parameters: {
    type: Type.OBJECT,
    description: 'Updates the HTML and CSS code for the motion graphic. ALWAYS provide the FULL new code for the respective file if you are changing it.',
    properties: {
      html: {
        type: Type.STRING,
        description: 'The complete HTML structure (inside the body tag).',
      },
      css: {
        type: Type.STRING,
        description: 'The complete CSS styles.',
      },
      explanation: {
        type: Type.STRING,
        description: 'A brief explanation of what changes were made.',
      }
    },
    required: ['explanation'],
  },
};

let aiClient: GoogleGenAI | null = null;

export const initializeGemini = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing");
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

export const createChatSession = (currentCode: CodeState) => {
  const ai = initializeGemini();
  if (!ai) throw new Error("AI Client not initialized");

  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `You are an expert Motion Graphics Designer and Front-End Engineer.
      You specialize in creating stunning, fluid animations using pure HTML and CSS.

      Your goal is to assist the user in building and refining a motion graphics scene.

      CONTEXT:
      You have persistent access to a single 'canvas'.
      Current HTML:
      ${currentCode.html}

      Current CSS:
      ${currentCode.css}

      RULES:
      1. When the user asks to change the animation, visualization, or layout, you MUST use the 'updateCode' tool.
      2. If you use 'updateCode', provide the FULL content of the HTML or CSS file you are modifying. Do not provide diffs.
      3. Focus on aesthetics: use gradients, shadows, smooth easing (bezier curves), and modern layouts.
      4. Keep the HTML structure semantic but focused on visual elements.
      5. Do not write Javascript. Focus on CSS Keyframes and transitions.

      ANIMATION CONSTRAINTS:
      - This is a TIMELINE-BASED motion graphics tool (like After Effects), NOT a looping animation system
      - The timeline duration is dynamic based on your animations (typical range: 5-30 seconds)
      - All animations MUST use 'animation-fill-mode: forwards' or include 'forwards' in the animation shorthand
      - NEVER use 'infinite' or looping animations - all animations should play exactly ONCE
      - Use 'animation-delay' to sequence animations along the timeline (e.g., delay: 2s means it starts at 2 seconds)
      - Use 'animation-duration' to control how long each animation takes
      - Set 'animation-iteration-count: 1' explicitly if needed, or use the shorthand with just duration and delay
      - Design animations to compose into a cohesive motion graphics sequence
      - Elements should animate in and hold their final state (via forwards), not loop or reset
      - The video export duration is automatically calculated as: max(delay + duration) across all animations

      CSS POSITIONING & STRUCTURE REQUIREMENTS (CRITICAL):
      - NEVER use 'Infinity', '-Infinity', 'NaN', or any invalid numeric values in CSS
      - All positioning values (top, left, right, bottom) MUST be valid numbers with units (px, %, rem, etc.)
      - Valid examples: "top: 50%", "left: 100px", "right: 20%"
      - Invalid examples: "top: -Infinity%", "left: NaN", "right: Infinity"
      - Every CSS class selector MUST have a corresponding HTML element
      - If CSS references .highlight-text, HTML MUST contain an element with class="highlight-text"
      - Do not create orphaned CSS rules - every rule must apply to an existing HTML element
      - Use flexbox/grid for centering, OR use "50% + transform: translate(-50%, -50%)" pattern
      - All absolute positioned elements must have valid, visible coordinates (typically 0-100% range)
      - Test that all elements will be visible on screen (not positioned at -10000px or similar)
      `,
      tools: [{ functionDeclarations: [updateCodeTool] }],
    },
  });
};

export const sendMessageToGemini = async (
  chatSession: any,
  message: string,
  onCodeUpdate: (updates: UpdateCodeArgs) => void
): Promise<string> => {
  try {
    const response = await chatSession.sendMessage({ message });
    
    const textResponse = response.text || "";
    
    // Check for function calls
    const functionCalls = response.functionCalls;
    
    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === 'updateCode') {
          const args = call.args as UpdateCodeArgs;
          onCodeUpdate(args);
          
          // We need to send the tool response back to the model to complete the turn
          // In a real robust app, we'd send the success status back.
          // For this simplified single-turn interactions logic:
          if (args.explanation) {
             return args.explanation;
          }
          return "Updated the visual code.";
        }
      }
      
      // If we processed tools, we might need to let the model summarize, 
      // but usually the explanation arg covers it. 
      // If the model didn't provide text output but called a function, we return a generic success message if explanation is missing.
    }

    return textResponse;

  } catch (error) {
    console.error("Gemini Error:", error);
    return "I encountered an error processing your request. Please try again.";
  }
};