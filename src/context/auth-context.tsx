
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, AuthCredentials } from '@/types';
import { Loader2 } from 'lucide-react';

// --- Hardcoded Admin Email ---
// For simplicity, we'll define the admin's email address here.
// In a real-world scenario, this might come from environment variables
// or a more sophisticated role management system in Firestore.
const ADMIN_EMAIL = 'admin@example.com';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (credentials: AuthCredentials & { displayName: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
          // User exists, just update the state with their data
          const userData = docSnap.data() as AppUser;
           setUser({
            ...userData,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: userData.displayName || firebaseUser.displayName,
          });
        } else {
          // New user registration or first-time login for an existing auth user
          // Determine role based on email
          const role = firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'cliente';
          
          const newUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: role,
          };
          
          // Create their document in Firestore
          await setDoc(userDocRef, { 
            ...newUser, 
            createdAt: serverTimestamp() 
          });
          
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async ({ email, password }: AuthCredentials) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setting the user state.
    } catch (error) {
      console.error("Error signing in: ", error);
      setLoading(false);
      throw error;
    }
  };
  
  const signUp = async ({ email, password, displayName }: AuthCredentials & { displayName: string }) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      await updateProfile(firebaseUser, { displayName });
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const role = email === ADMIN_EMAIL ? 'admin' : 'cliente'; // Assign role on sign up
      
      const newUser: AppUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: displayName,
        photoURL: null,
        role: role,
      };
      await setDoc(userDocRef, { ...newUser, createdAt: serverTimestamp() });
      
      // The onAuthStateChanged listener will set the user state
      // No need to call setUser here to avoid race conditions.

    } catch (error) {
        console.error("Error signing up: ", error);
        setLoading(false);
        throw error;
    }
  };


  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };
  
  // Display a full-screen loader while checking auth state initially
  if (loading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
