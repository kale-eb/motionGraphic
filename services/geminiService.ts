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