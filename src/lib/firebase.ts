// Import the functions you need from the SDKs you need
import { initializeApp, FirebaseApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * @fileoverview This file initializes the Firebase app and Firestore database.
 * It exports the initialized Firebase app and Firestore db objects.
 * 
 * To use this file:
 * 1. Create a .env.local file in the root of your project.
 * 2. Add your Firebase configuration values to the .env.local file, prefixed with NEXT_PUBLIC_FIREBASE_:
 *    NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key"
 *    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_auth_domain"
 *    NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
 *    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_storage_bucket"
 *    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_messaging_sender_id"
 *    NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"
 * 3. Import the db object in your components:
 *    import { db } from './lib/firebase';
 * 
 */

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCI7CedFB4uXRKp0dBloP_c42WNr9uIkU8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "catalogify-htws4.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "catalogify-htws4",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "catalogify-htws4.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "322550483925",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:322550483925:web:cfa4449ed1dda67457cb5c",
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app); // Initialize Firestore
const auth = getAuth(app); // Initialize Firebase Auth


console.log("Firebase initialized successfully.");


console.log("app is defined:", typeof app !== 'undefined');
console.log("db is defined:", typeof db !== 'undefined');

console.log(firebaseConfig)

export { app, db, auth, firebaseConfig };