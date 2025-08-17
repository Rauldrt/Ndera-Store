
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Item, Catalog } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, PackageSearch, ImageOff, ShoppingCart, Plus, Minus, Search, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/cart-context';
import { useToast } from '@/hooks/use-toast';
import { notFound, useParams } from 'next/navigation';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Separator } from '@/components/ui/separator';
import { ItemDetailModal } from '@/components/item/item-detail-modal';
import { CartSummary } from '@/components/cart/cart-summary';


interface ItemWithTimestamp extends Omit<Item, 'createdAt'> {
  createdAt: Timestamp | null;
}

export default function CatalogPage() {
  const params = useParams();
  const catalogId = params.catalogId as string;
  const queryClient = useQueryClient();
  const cartContext = useCart();
  const toastContext = useToast();
  const [selectedItem, setSelectedItem] = useState<ItemWithTimestamp | null>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


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
        // Only fetch visible items for public view
        const q = query(itemsCollection, where('catalogId', '==', catalogId), where('isVisible', '==', true));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                description: data.description,
                price: data.price,
                imageUrl: data.imageUrl,
                tags: data.tags,
                createdAt: data.createdAt as Timestamp,
                catalogId: data.catalogId,
                isFeatured: data.isFeatured,
            } as ItemWithTimestamp;
        });
    },
    enabled: !!catalogId,
  });

  const { featuredItems, regularItems } = useMemo(() => {
    if (!items) return { featuredItems: [], regularItems: [] };
    const featured = items.filter(item => item.isFeatured);
    const regular = items.filter(item => !item.isFeatured);
    return { featuredItems: featured, regularItems: regular };
  }, [items]);
  
  if (isLoadingCatalog || isLoadingItems) {
    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden h-64 w-full flex items-center justify-center">
                 <Skeleton className="w-full h-full" />
            </div>
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    {[...Array(5)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="p-0">
                                <Skeleton className="aspect-video w-full" />
                            </CardHeader>
                            <CardContent className="p-4">
                                <Skeleton className="h-6 w-3/4 mb-2" />
                                <Skeleton className="h-5 w-1/2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
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
  
  const handleAddToCart = (item: ItemWithTimestamp, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.createdAt) {
        toast({
            title: "Error",
            description: "Este producto no se puede añadir al carrito.",
            variant: "destructive",
        });
        return;
    }
    addToCart({ ...item, quantity: 1, createdAt: item.createdAt, catalogName: catalogDetails.name }, catalogId);
    toast({
      title: "Producto Añadido",
      description: `${item.name} ha sido añadido a tu carrito.`,
    });
  };

  const handleIncreaseQuantity = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemInCart = cart.find(cartItem => cartItem.id === itemId);
    if (itemInCart) {
      updateQuantity(itemId, itemInCart.quantity + 1);
    }
  };

  const handleDecreaseQuantity = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemInCart = cart.find(cartItem => cartItem.id === itemId);
    if (itemInCart) {
      updateQuantity(itemId, itemInCart.quantity - 1);
    }
  };

  const renderItemCard = (item: ItemWithTimestamp, index: number) => {
    const itemInCart = cart.find(cartItem => cartItem.id === item.id);
    return (
        <Card 
            key={item.id} 
            className="group flex flex-col overflow-hidden rounded-lg border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
            onClick={() => setSelectedItem(item)}
        >
          <CardHeader className="p-0">
            <div className="aspect-video relative bg-muted overflow-hidden">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name || 'Imagen del producto'}
                  className="transition-transform duration-300 group-hover:scale-105 w-full h-full object-cover"
                  data-ai-hint="product photo"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://placehold.co/400x300.png`;
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
            <CardTitle className="text-lg mb-1 line-clamp-2 font-semibold flex-grow">{item.name}</CardTitle>
            <p className="text-md font-bold text-primary mt-2">${(item.price ?? 0).toFixed(2)}</p>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 p-3 border-t bg-background/50">
            {itemInCart ? (
              <div className="flex items-center justify-center w-full gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={(e) => handleDecreaseQuantity(item.id, e)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="font-bold text-lg w-10 text-center">{itemInCart.quantity}</span>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={(e) => handleIncreaseQuantity(item.id, e)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" onClick={(e) => handleAddToCart(item, e)} className="w-full">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Añadir al carrito
              </Button>
            )}
          </CardFooter>
        </Card>
      );
  };

  return (
    <>
    <div className="relative overflow-hidden h-64 w-full flex items-center justify-center">
        <div className="absolute inset-0">
          <img
            src={catalogDetails?.imageUrl || 'https://placehold.co/1200x400.png'}
            alt={catalogDetails?.name || ''}
            className="w-full h-full object-cover"
            style={{ transform: `translateY(${scrollY * 0.4}px)` }}
            data-ai-hint="background image"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 w-full text-white text-center p-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white shadow-lg [text-shadow:0_2px_4px_var(--tw-shadow-color)]">
                {catalogDetails.name}
            </h1>
            {catalogDetails.description && (
                <p className="mt-2 text-sm sm:text-base md:text-lg text-white/90 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">
                    {catalogDetails.description}
                </p>
            )}
        </div>
      </div>
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Featured Items Carousel */}
        {featuredItems.length > 0 && (
          <div className='space-y-4'>
              <div className='flex items-center gap-2'>
                <Star className="h-6 w-6 text-yellow-500" />
                <h2 className="text-2xl font-bold text-foreground">Productos Destacados</h2>
              </div>
              <div className="relative px-12">
                  <Carousel
                      opts={{
                          align: "start",
                          loop: featuredItems.length > 3,
                      }}
                      className="w-full"
                  >
                      <CarouselContent className="-ml-4">
                          {featuredItems.map((item) => {
                            const itemInCart = cart.find(cartItem => cartItem.id === item.id);
                            return (
                              <CarouselItem key={item.id} className="md:basis-1/2 lg:basis-1/3 pl-4">
                                  <div className="p-1 h-full">
                                      <Card 
                                        className="group relative w-full h-full aspect-[4/3] overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl cursor-pointer"
                                        onClick={() => setSelectedItem(item)}
                                      >
                                          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                                          {itemInCart ? (
                                              <div className="flex items-center justify-center gap-2 rounded-full bg-background/80 p-1">
                                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground hover:bg-white/80" onClick={(e) => handleDecreaseQuantity(item.id, e)}>
                                                      <Minus className="h-4 w-4" />
                                                  </Button>
                                                  <span className="font-bold text-base w-6 text-center text-foreground">{itemInCart.quantity}</span>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground hover:bg-white/80" onClick={(e) => handleIncreaseQuantity(item.id, e)}>
                                                      <Plus className="h-4 w-4" />
                                                  </Button>
                                              </div>
                                          ) : (
                                              <Button variant="default" size="sm" onClick={(e) => handleAddToCart(item, e)}>
                                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                                  Añadir
                                              </Button>
                                          )}
                                          </div>
                                          {item.imageUrl ? (
                                              <img
                                                  src={item.imageUrl}
                                                  alt={item.name || 'Imagen del producto'}
                                                  className="object-cover w-full h-full transition-transform duration-500 ease-in-out group-hover:scale-105"
                                                  data-ai-hint="product photo"
                                                  onError={(e) => {
                                                      const target = e.target as HTMLImageElement;
                                                      target.src = `https://placehold.co/400x300.png`;
                                                      target.dataset.aiHint = "placeholder image";
                                                  }}
                                              />
                                          ) : (
                                              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted via-background to-muted">
                                                  <ImageOff size={48} />
                                              </div>
                                          )}
                                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 flex flex-col justify-end">
                                            <CardTitle className="text-2xl font-bold text-white shadow-black [text-shadow:0_2px_4px_var(--tw-shadow-color)] line-clamp-2">{item.name}</CardTitle>
                                            <p className="text-lg font-semibold text-white mt-1 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">${(item.price ?? 0).toFixed(2)}</p>
                                          </div>
                                      </Card>
                                  </div>
                              </CarouselItem>
                            )
                          })}
                      </CarouselContent>
                      <CarouselPrevious className="hidden sm:flex" />
                      <CarouselNext className="hidden sm:flex" />
                  </Carousel>
              </div>
              <Separator className="my-6" />
          </div>
        )}
        
        {!items || items.length === 0 ? (
             <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No hay productos en este catálogo</h3>
                <p className="text-muted-foreground mb-4">Parece que este catálogo aún no tiene productos disponibles.</p>
            </div>
        ) : (
            <>
                {regularItems.length > 0 && (
                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 items-stretch">
                         {regularItems.map(renderItemCard)}
                     </div>
                )}
            </>
        )}
    </div>
    <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    <CartSummary />
    </>
  );
}
