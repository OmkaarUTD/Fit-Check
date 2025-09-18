/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { WardrobeItem } from "../types";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        throw new Error(errorMessage);
    }
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image. ` + (textFeedback ? `The model responded with text: "${textFeedback}"` : "This can happen due to safety filters or if the request is too complex. Please try a different image.");
    throw new Error(errorMessage);
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const imageModel = 'gemini-2.5-flash-image-preview';

export const generateModelImage = async (userImage: File): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    const prompt = "You are an expert fashion photographer AI. Transform the person in this image into a full-body fashion model photo suitable for an e-commerce website. The background must be a clean, neutral studio backdrop (light gray, #f0f0f0). The person should have a neutral, professional model expression. Preserve the person's identity, unique features, and body type, but place them in a standard, relaxed standing model pose. The final image must be photorealistic. Return ONLY the final image.";
    const response = await ai.models.generateContent({
        model: imageModel,
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};

export const generateGarmentTryOnImage = async (modelImageUrl: string, itemImage: File): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const itemImagePart = await fileToPart(itemImage);
    
    const garmentPrompt = `You are an expert virtual try-on AI. You will be given a 'model image' and a 'garment image'. Your task is to create a new photorealistic image where the person from the 'model image' is wearing the clothing from the 'garment image'.

**Crucial Rules:**
1.  **Complete Garment Replacement:** You MUST completely REMOVE and REPLACE the clothing item worn by the person in the 'model image' with the new garment. No part of the original clothing (e.g., collars, sleeves, patterns) should be visible in the final image.
2.  **Preserve the Model:** The person's face, hair, body shape, and pose from the 'model image' MUST remain unchanged.
3.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly.
4.  **Apply the Garment:** Realistically fit the new garment onto the person. It should adapt to their pose with natural folds, shadows, and lighting consistent with the original scene.
5.  **Output:** Return ONLY the final, edited image. Do not include any text.`;
    
    const response = await ai.models.generateContent({
        model: imageModel,
        contents: { parts: [modelImagePart, itemImagePart, { text: garmentPrompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};


export const generateAccessoryTryOnImage = async (modelImageUrl: string, accessoryFiles: File[], accessories: WardrobeItem[]): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const accessoryImageParts = await Promise.all(accessoryFiles.map(file => fileToPart(file)));

    const accessoryNames = accessories.map(acc => acc.name).join(', and ');

    const prompt = `You are an expert virtual try-on AI. You will be given a 'model image' and one or more 'accessory images'. Your task is to create a new photorealistic image by ADDING the following accessories: ${accessoryNames}.

**Crucial Rules:**
1.  **Additive Change:** You MUST NOT replace or remove the existing clothing on the model. The accessories should be realistically placed on top of or with the existing outfit.
2.  **Layering:** Apply the accessories in a logical order. For example, sunglasses go on the face, a hat goes on the head. If multiple accessories are provided, layer them naturally.
3.  **Preserve the Model & Outfit:** The person's face, hair, body shape, pose, and existing clothing from the 'model image' MUST remain unchanged, except for where the accessories naturally cover them.
4.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly.
5.  **Apply the Accessories:** Realistically fit the accessories onto the person. They should adapt to their pose and interact with their clothing with natural folds, shadows, and lighting consistent with the original scene.
6.  **Output:** Return ONLY the final, edited image. Do not include any text.`;

    const response = await ai.models.generateContent({
        model: imageModel,
        contents: { parts: [modelImagePart, ...accessoryImageParts, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string): Promise<string> => {
    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    const prompt = `You are an expert fashion photographer AI. Take this image and regenerate it from a different perspective. The person, clothing, and background style must remain identical. The new perspective should be: "${poseInstruction}". Return ONLY the final image.`;
    const response = await ai.models.generateContent({
        model: imageModel,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};

export const generateStyleScore = async (items: WardrobeItem[]): Promise<{ score: number, critique: string }> => {
    if (items.length === 0) {
        return { score: 0, critique: "Add some items to get a style score!" };
    }

    const outfitDescription = items.map(item => `- ${item.name} (${item.type})`).join('\n');

    const prompt = `You are a world-class fashion stylist AI. Analyze the following outfit combination and provide a style score.

Outfit Items:
${outfitDescription}

Based on the combination, provide:
1.  A score from 1 to 10, where 1 is a fashion disaster and 10 is runway-ready.
2.  A brief, constructive critique or compliment (1-2 sentences max) explaining your score. Consider color harmony, item complementarity, and overall style.

Return ONLY a JSON object with your analysis.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: {
                        type: Type.NUMBER,
                        description: 'A style score from 1 to 10.',
                    },
                    critique: {
                        type: Type.STRING,
                        description: 'A brief critique or compliment for the outfit.',
                    },
                },
                required: ["score", "critique"],
            },
        },
    });

    try {
        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);
        
        if (typeof result.score === 'number' && typeof result.critique === 'string') {
            return {
                score: Math.max(1, Math.min(10, result.score)), // Clamp score between 1 and 10
                critique: result.critique,
            };
        } else {
            throw new Error("Invalid JSON structure received from API.");
        }
    } catch (e) {
        console.error("Failed to parse style score JSON:", e);
        throw new Error("The AI returned an unexpected format for the style score. Please try again.");
    }
};