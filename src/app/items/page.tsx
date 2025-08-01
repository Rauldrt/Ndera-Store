
'use client';

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Item } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, PackageSearch, ImageOff, Edit, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ItemWithTimestamp extends Omit<Item, 'createdAt'> {
  createdAt: Timestamp | null;
}

export default function AllItemsPage() {
  const queryClient = useQueryClient();

  const {
    data: items,
    isLoading,
    error,
  } = useQuery<ItemWithTimestamp[]>({
    queryKey: ['allItems'],
    queryFn: async () => {
      const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          imageUrl: data.imageUrl,
          tags: data.tags,
          createdAt: data.createdAt as Timestamp,
          catalogId: data.catalogId,
        } as ItemWithTimestamp;
      });
    },
  });

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Todos los Productos</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Explora todos los productos de tus catálogos.</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <Skeleton className="aspect-video w-full mb-4" data-ai-hint="placeholder image" />
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent className="flex-grow">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3 mb-3" />
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center text-destructive py-10">
          <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
          <p className="font-semibold">Error al cargar los productos.</p>
          <p className="text-sm text-muted-foreground">
            Por favor, inténtalo de nuevo más tarde.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => queryClient.refetchQueries({ queryKey: ['allItems'] })}>
            Intentar de Nuevo
          </Button>
        </div>
      )}

      {!isLoading && !error && items && items.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No se encontraron productos</h3>
          <p className="text-muted-foreground mb-4">Parece que aún no has añadido ningún producto a tus catálogos.</p>
          <Link href="/">
            <Button>
              Volver al inicio
            </Button>
          </Link>
        </div>
      )}

      {!isLoading && !error && items && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 items-stretch">
          {items.map((item, index) => (
            <Card key={item.id} className="group flex flex-col overflow-hidden rounded-lg border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardHeader className="p-0">
                <div className="aspect-video relative bg-muted overflow-hidden">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name || 'Imagen del producto'}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      style={{ objectFit: 'cover' }}
                      priority={index < 10}
                      className="transition-transform duration-300 group-hover:scale-105"
                      data-ai-hint="product photo"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://placehold.co/400x300.png`;
                        target.srcset = '';
                        target.dataset.aiHint = 'placeholder image';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted via-background to-muted">
                      <ImageOff size={48} />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow p-4 flex flex-col">
                <CardTitle className="text-lg mb-2 line-clamp-2 font-semibold">{item.name}</CardTitle>
                <CardDescription className="text-sm mb-4 line-clamp-3 flex-grow">{item.description}</CardDescription>
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {Array.isArray(item.tags) && item.tags.slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-medium">{tag}</Badge>
                  ))}
                  {Array.isArray(item.tags) && item.tags.length > 5 && (
                    <Badge variant="outline" className="text-xs">...</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
