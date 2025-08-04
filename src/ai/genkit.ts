import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// The googleAI plugin automatically looks for the GOOGLE_API_KEY
// environment variable if no apiKey is explicitly provided.
// Ensure GOOGLE_API_KEY is set in your .env file.
export const ai = genkit({
  plugins: [
    googleAI({
        // Explicitly specifying the API key (optional, but good practice)
        // Reads from process.env.GOOGLE_API_KEY
        apiKey: process.env.GOOGLE_API_KEY,
        // Preview models require specifying the v1beta API version.
        apiVersion: 'v1beta',
    }),
],
  model: 'googleai/gemini-2.0-flash', // Default model for general tasks
});
