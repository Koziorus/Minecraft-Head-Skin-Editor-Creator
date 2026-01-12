import { GoogleGenAI } from "@google/genai";
import { GeneratorConfig } from '../types';

export const generateGiveCommand = async (
  base64Skin: string, 
  config: GeneratorConfig
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Generate a valid Minecraft Java Edition 1.20+ /give command for a Player Head.
    
    Skin Value (Base64): "${base64Skin}"
    
    Requirements:
    - Item Name: "${config.itemName || 'Custom Head'}" (JSON text format)
    - Lore: "${config.itemLore || ''}" (JSON text format, array)
    - Unbreakable: ${config.isUnbreakable}
    - Enchanted (Glint): ${config.enchantments} (Add an enchantment like unbreaking 1 and hide flags if true)
    
    Output ONLY the command string starting with /give. Do not add markdown blocks or explanations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text?.trim() || "Error generating command.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating command. Please check your API key.";
  }
};

export const suggestSkinPalette = async (theme: string): Promise<string[]> => {
    if (!process.env.API_KEY) return ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000'];
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Generate a JSON array of 5 hex color codes for a Minecraft skin with the theme: "${theme}". Return only the JSON array.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        const text = response.text;
        if (!text) return [];
        return JSON.parse(text);
    } catch (e) {
        return ['#ffffff', '#000000'];
    }
}
