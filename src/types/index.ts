import type { Timestamp } from 'firebase/firestore';

export interface Catalog {
  id: string;
  name: string;
  description: string; // Keep description optional as per form schema
  createdAt: Timestamp; // Use Firestore Timestamp
}

export interface Item {
  id: string;
  catalogId: string;
  name: string;
  description: string;
  imageUrl?: string; // Optional image URL
  tags: string[];
  createdAt: Timestamp; // Use Firestore Timestamp
}

