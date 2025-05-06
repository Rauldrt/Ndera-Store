# Firebase Studio - Catalogify

This is a Next.js application built with Firebase and Genkit for managing catalogs and leveraging AI features like tag suggestions.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set up Firebase:**
    *   Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/).
    *   Enable Firestore in your project.
    *   Go to Project Settings > General.
    *   Under "Your apps", click the Web icon (`</>`) to register a web app.
    *   Copy the `firebaseConfig` object provided.
    *   Create a `.env.local` file in the root of the project (if it doesn't exist).
    *   Add the Firebase config values to `.env.local`, prefixing each key with `NEXT_PUBLIC_FIREBASE_`:
        ```dotenv
        NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
        NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
        ```
        Replace `YOUR_*` with the actual values from your Firebase config.

3.  **Set up Gemini API Key:**
    *   Obtain a Gemini API key from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
    *   Add the API key to your `.env` file (create it if it doesn't exist):
        ```dotenv
        GOOGLE_API_KEY=YOUR_API_KEY_HERE
        ```
        Replace `YOUR_API_KEY_HERE` with your actual Gemini API key.
    *   **Important:** Also add this key to your `.env.local` file for client-side access if needed by certain flows or components directly (though flows run server-side by default).
        ```dotenv
        # .env.local
        GOOGLE_API_KEY=YOUR_API_KEY_HERE
        NEXT_PUBLIC_FIREBASE_API_KEY=...
        # ... other firebase keys
        ```
    *   **Security Note:** Keep your `.env` and `.env.local` files out of version control (ensure they are listed in your `.gitignore` file).

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    This will start the Next.js application, usually on `http://localhost:9002`.

5.  **Run the Genkit Development Server (in a separate terminal):**
    ```bash
    npm run genkit:watch
    ```
    This starts the Genkit development flow server, necessary for AI features.

6.  Open [http://localhost:9002](http://localhost:9002) in your browser to see the application.

## Project Structure

*   `src/app/`: Contains the main application pages and layout (Next.js App Router).
*   `src/components/`: Reusable React components.
    *   `src/components/ui/`: UI components from ShadCN.
    *   `src/components/catalog/`: Components related to catalogs.
    *   `src/components/item/`: Components related to catalog items.
*   `src/ai/`: Contains AI-related code using Genkit.
    *   `src/ai/flows/`: Genkit flows defining AI tasks (e.g., tag suggestion).
    *   `src/ai/genkit.ts`: Genkit initialization and configuration.
*   `src/lib/`: Utility functions and library initializations (e.g., Firebase).
*   `src/hooks/`: Custom React hooks.
*   `src/types/`: TypeScript type definitions.
*   `public/`: Static assets.
*   `.env.local`: Local environment variables (Firebase keys, etc. - **DO NOT COMMIT**).
*   `.env`: Environment variables for build/server processes (Gemini Key - **DO NOT COMMIT**).

## Key Features

*   **Catalog Management:** Create, read, update, and delete catalogs.
*   **Item Management:** Add, edit, and delete items within catalogs, including image URLs and tags.
*   **AI Tag Suggestions:** Uses Genkit and Gemini to suggest relevant tags for items based on their description.
*   **Responsive Design:** Adapts to different screen sizes.
*   **Modern UI:** Built with ShadCN UI components and Tailwind CSS.
*   **Data Fetching:** Uses TanStack Query for efficient data fetching and caching with Firestore.
