'use server';

/**
 * @fileOverview AI-powered tag suggestion for catalog items.
 *
 * - suggestTags - A function that suggests relevant tags for a catalog item based on its description.
 * - SuggestTagsInput - The input type for the suggestTags function.
 * - SuggestTagsOutput - The return type for the suggestTags function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTagsInputSchema = z.object({
  itemDescription: z
    .string()
    .min(10, 'Item description must be at least 10 characters long.') // Add min length for better suggestions
    .describe('The description of the catalog item for which to suggest tags.'),
});
export type SuggestTagsInput = z.infer<typeof SuggestTagsInputSchema>;

const SuggestTagsOutputSchema = z.object({
  tags: z
    .array(z.string().max(50, "Tag should not exceed 50 characters"))
    .max(5, "Suggest a maximum of 5 tags.") // Limit the number of suggestions
    .describe('An array of 3-5 relevant suggested tags (lowercase, single or two words max per tag) for the catalog item. If no relevant tags are found, return an empty array.'),
});
export type SuggestTagsOutput = z.infer<typeof SuggestTagsOutputSchema>;

export async function suggestTags(input: SuggestTagsInput): Promise<SuggestTagsOutput> {
  // Validate input using Zod schema before calling the flow
  const validationResult = SuggestTagsInputSchema.safeParse(input);
  if (!validationResult.success) {
    // Construct a user-friendly error message from Zod issues
    const errorMessage = validationResult.error.issues.map(issue => issue.message).join(', ');
    throw new Error(`Invalid input for tag suggestion: ${errorMessage}`);
  }
  return suggestTagsFlow(validationResult.data);
}

const prompt = ai.definePrompt({
  name: 'suggestTagsPrompt',
  input: {schema: SuggestTagsInputSchema},
  output: {schema: SuggestTagsOutputSchema},
  prompt: `You are a cataloging expert. Based on the following item description, suggest 3 to 5 highly relevant, concise tags (single or two words maximum per tag, all lowercase) to improve discoverability.
Focus on the most important keywords and attributes.
If no relevant tags can be derived from the description, return an empty array for the "tags" field.

Item Description:
{{{itemDescription}}}

Return the tags as a JSON object with a "tags" field containing an array of strings, like this: {"tags": ["tag1", "tag2"]}.
Example for "Vintage leather jacket, brown, size medium, good condition": {"tags": ["vintage jacket", "leather", "brown", "medium size"]}
Example for "A simple rock": {"tags": []}`,
});

const suggestTagsFlow = ai.defineFlow(
  {
    name: 'suggestTagsFlow',
    inputSchema: SuggestTagsInputSchema,
    outputSchema: SuggestTagsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
        // This case should ideally be handled by the LLM returning an empty array
        // based on the prompt instructions, but as a fallback:
        console.warn('AI prompt for tag suggestion returned undefined. Returning empty tags.');
        return { tags: [] };
    }
    // Ensure tags is an array, even if the LLM fails to format correctly.
    // And ensure all tags are lowercase as per requirement.
    return {
      tags: Array.isArray(output.tags) ? output.tags.map(tag => String(tag).toLowerCase()) : [],
    };
  }
);

