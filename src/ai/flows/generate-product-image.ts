'use server';

/**
 * @fileOverview AI-powered product image generation.
 *
 * - generateProductImage - A function that generates a product image based on its name and description.
 * - GenerateProductImageOutput - The return type for the generateProductImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateProductImageInputSchema = z.object({
  name: z.string().describe('The name of the product.'),
  description: z.string().describe('A detailed description of the product.'),
});
export type GenerateProductImageInput = z.infer<typeof GenerateProductImageInputSchema>;

const GenerateProductImageOutputSchema = z.object({
  imageUrl: z.string().url().describe('The data URI of the generated product image.'),
});
export type GenerateProductImageOutput = z.infer<typeof GenerateProductImageOutputSchema>;

export async function generateProductImage(input: GenerateProductImageInput): Promise<GenerateProductImageOutput> {
  return generateProductImageFlow(input);
}

const generateProductImageFlow = ai.defineFlow(
  {
    name: 'generateProductImageFlow',
    inputSchema: GenerateProductImageInputSchema,
    outputSchema: GenerateProductImageOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      // IMPORTANT: ONLY this model can generate images.
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `Generate a photorealistic image of the following product. 
The product should be on a clean, neutral background.
Product Name: ${input.name}
Description: ${input.description}`,
      config: {
        // You MUST provide both TEXT and IMAGE, IMAGE only won't work
        responseModalities: ['TEXT', 'IMAGE'], 
      },
    });

    if (!media.url) {
      throw new Error('Image generation failed to return a valid image URL.');
    }
    
    return {
      imageUrl: media.url,
    };
  }
);
