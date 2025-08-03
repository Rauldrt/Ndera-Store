
'use client';

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Item, Catalog } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, PackageSearch, ImageOff, ShoppingCart, Plus, Minus, Search } from 'lucide-react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/cart-context';
import { useToast } from '@/hooks/use-toast';
import { notFound } from 'next/navigation';

interface ItemWithTimestamp extends Omit<Item, 'createdAt'> {
  createdAt: Timestamp | null;
}

interface CatalogPageProps {
    params: {
        catalogId: string;
    };
}

export default function CatalogPage({ params }: CatalogPageProps) {
  const { catalogId } = params;
  const queryClient = useQueryClient();
  const cartContext = useCart();
  const toastContext = useToast();

  if (!cartContext || !toastContext) {
    return <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mt-10" />;
  }

  const { cart, addToCart, updateQuantity } = cartContext;
  const { toast } = toastContext;

  const { data: catalogDetails, isLoading: isLoadingCatalog, error: catalogError } = useQuery<Catalog | null>({
    queryKey: ['catalog', catalogId],
    queryFn: async () => {
        if (!catalogId) return null;
        const docRef = doc(db, 'catalogs', catalogId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Catalog : null;
    },
    enabled: !!catalogId,
  });

  const { data: items, isLoading: isLoadingItems, error: itemsError } = useQuery<ItemWithTimestamp[]>({
    queryKey: ['items', catalogId],
    queryFn: async () => {
        const itemsCollection = collection(db, 'items');
        const q = query(itemsCollection, where('catalogId', '==', catalogId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as ItemWithTimestamp);
    },
    enabled: !!catalogId,
  });
  
  if (isLoadingCatalog || isLoadingItems) {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-5 w-1/2 mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {[...Array(5)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="aspect-video w-full mb-4" />
                            <Skeleton className="h-6 w-3/4" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
  }

  if (catalogError || itemsError) {
     return (
        <div className="text-center text-destructive py-10">
          <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
          <p className="font-semibold">Error al cargar el catálogo.</p>
        </div>
     )
  }

  if (!catalogDetails) {
    // This will render the not-found.js file in the root of the app directory
    notFound();
    return null;
  }
  
  const handleAddToCart = async (item: ItemWithTimestamp) => {
    if (!item.createdAt) {
        toast({
            title: "Error",
            description: "Este producto no se puede añadir al carrito.",
            variant: "destructive",
        });
        return;
    }
    const price = Math.floor(Math.random() * 100) + 10;
    addToCart({ ...item, price, quantity: 1, createdAt: item.createdAt, catalogName: catalogDetails.name });
    toast({
      title: "Producto Añadido",
      description: `${item.name} ha sido añadido a tu carrito.`,
    });
  };

  const handleIncreaseQuantity = (itemId: string) => {
    const itemInCart = cart.find(cartItem => cartItem.id === itemId);
    if (itemInCart) {
      updateQuantity(itemId, itemInCart.quantity + 1);
    }
  };

  const handleDecreaseQuantity = (itemId: string) => {
    const itemInCart = cart.find(cartItem => cartItem.id === itemId);
    if (itemInCart) {
      updateQuantity(itemId, itemInCart.quantity - 1);
    }
  };

  const renderItemCard = (item: ItemWithTimestamp, index: number) => {
    const itemInCart = cart.find(cartItem => cartItem.id === item.id);
    return (
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
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 p-3 border-t bg-background/50">
            {itemInCart ? (
              <div className="flex items-center justify-center w-full gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleDecreaseQuantity(item.id)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="font-bold text-lg w-10 text-center">{itemInCart.quantity}</span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => handleIncreaseQuantity(item.id)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" onClick={() => handleAddToCart(item)} className="w-full">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Añadir al carrito
              </Button>
            )}
          </CardFooter>
        </Card>
      );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{catalogDetails.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">{catalogDetails.description}</p>
        </div>
        
        {!items || items.length === 0 ? (
             <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No hay productos en este catálogo</h3>
                <p className="text-muted-foreground mb-4">Parece que este catálogo aún no tiene productos disponibles.</p>
            </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 items-stretch">
                {items.map(renderItemCard)}
            </div>
        )}
    </div>
  );
}
