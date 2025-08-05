
import type { Timestamp } from 'firebase/firestore';

export interface Catalog {
  id: string;
  name: string;
  description: string;
  imageUrl?: string; // Optional image for the catalog card background
  createdAt: Timestamp; // Use Firestore Timestamp
  userId: string; // ID of the user who owns this catalog
}

export interface Item {
  id:string;
  catalogId: string;
  name: string;
  description: string;
  price: number; // The price of the item
  imageUrl?: string; // Optional image URL
  tags: string[];
  createdAt: Timestamp; // Use Firestore Timestamp
  isFeatured?: boolean; // To mark item as featured
  isVisible?: boolean; // To control visibility in the store
}

// Defines the structure for an item inside the shopping cart
export interface CartItem extends Item {
    quantity: number;
    catalogName?: string; // Optional catalog name
}

// Defines the structure for a customer
export interface Customer {
    id: string; // Firestore document ID
    name: string;
    email: string;
    phone: string;
    address: string;
    geolocation?: {
      latitude: number;
      longitude: number;
    };
    createdAt: Timestamp;
    lastOrderDate: Timestamp;
}

// Defines the structure for an order
export interface Order {
    id: string; // Firestore document ID
    customerId: string;
    customerInfo: {
        name: string;
        email: string;
    };
    items: {
        id: string;
        name: string;
        quantity: number;
        price: number;
    }[];
    total: number;
    paymentMethod: string;
    createdAt: Timestamp;
}

// User-related types
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'client';
}

export interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<any>;
  signUp: (email: string, pass: string, name: string) => Promise<any>;
  signOutUser: () => Promise<void>;
}
