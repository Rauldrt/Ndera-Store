
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, AuthContextType } from '@/types';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

// Email for the admin user
const ADMIN_EMAIL = 'admin@example.com';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, get their custom data from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: userData.role, // Get role from Firestore
          });
        } else {
            // This case happens if a user was created in auth but not in firestore.
            // We create the user document on the fly.
            const role = firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'client';
            const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Nuevo Usuario';
            
            const newUser: AppUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: displayName,
                photoURL: firebaseUser.photoURL,
                role: role,
            };

            await setDoc(doc(db, 'users', firebaseUser.uid), {
                displayName: displayName,
                email: firebaseUser.email,
                role: role,
                createdAt: serverTimestamp(),
            });
            setUser(newUser);
        }
      } else {
        // User is signed out
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (email: string, pass: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const firebaseUser = userCredential.user;

    // Update Firebase Auth profile
    await updateProfile(firebaseUser, { displayName: name });

    // Create user document in Firestore
    const role = email === ADMIN_EMAIL ? 'admin' : 'client';
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(userDocRef, {
      displayName: name,
      email: email,
      role: role,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });

    return userCredential;
  };

  const signOutUser = () => {
    return signOut(auth);
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOutUser,
  };

  if (loading) {
     return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
        </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
