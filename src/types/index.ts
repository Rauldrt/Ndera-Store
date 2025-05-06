import type { Timestamp } from 'firebase/firestore';

export interface Catalog {
  id: string;
  name: string;
  description: string;
  createdAt: Timestamp;
}

export interface Item {
  id: string;
  catalogId: string;
  name: string;
  description: string;
  imageUrl?: string; // Optional image URL
  tags: string[];
  createdAt: Timestamp;
}
