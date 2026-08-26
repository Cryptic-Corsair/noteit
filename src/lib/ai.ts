import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const analyzeCanvas = createServerFn({ method: "POST" })
  .validator((data: { image: string; prompt: string }) => data)
  .handler(async (ctx) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { image, prompt } = ctx.data;

    const base64Data = image.split(",")[1];
    if (!base64Data) {
      throw new Error("Invalid image format");
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt || "Analyze this drawing." },
              { inlineData: { mimeType: "image/png", data: base64Data } },
            ],
          },
        ],
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      return { text: response.text };
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message || "Failed to analyze canvas");
    }
  });
