'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Item, Catalog } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, PackageSearch, ImageOff, ShoppingCart, Plus, Minus, Search, Tag, X, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/cart-context';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Separator } from '@/components/ui/separator';

interface ItemWithTimestamp extends Omit<Item, 'createdAt'> {
  createdAt: Timestamp | null;
}

export default function AllItemsPage() {
  const queryClient = useQueryClient();
  const cartContext = useCart();
  const toastContext = useToast();
  
  if (!cartContext || !toastContext) {
    // This can happen during the initial render if the context is not yet available.
    // You can return a loading state or null.
    return <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mt-10" />;
  }

  const { cart, addToCart, updateQuantity } = cartContext;
  const { toast } = toastContext;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');

  const {
    data: items,
    isLoading,
    error,
  } = useQuery<ItemWithTimestamp[]>({
    queryKey: ['allItems'],
    queryFn: async () => {
      const itemsCollection = collection(db, 'items');
      const q = query(itemsCollection, orderBy('createdAt', 'desc'));
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
          isFeatured: data.isFeatured,
        } as ItemWithTimestamp;
      });
    },
  });

  const allTags = useMemo(() => {
    if (!items) return [];
    const tagsSet = new Set<string>();
    items.forEach(item => {
      if (Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
            if(tag) tagsSet.add(tag)
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [items]);

  const { featuredItems, filteredItems } = useMemo(() => {
    if (!items) return { featuredItems: [], filteredItems: [] };
    
    const featured = items.filter(item => item.isFeatured);
    let regularItems = items.filter(item => !item.isFeatured);

    if (selectedTag && selectedTag !== 'all') {
      regularItems = regularItems.filter(item => Array.isArray(item.tags) && item.tags.includes(selectedTag));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      regularItems = regularItems.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    
    return { featuredItems: featured, filteredItems: regularItems };
  }, [items, searchQuery, selectedTag]);

  const getCatalogName = async (catalogId: string) => {
    const cachedCatalogs = queryClient.getQueryData<Catalog[]>(['catalogs']);
    const cachedCatalog = cachedCatalogs?.find(c => c.id === catalogId);
    if (cachedCatalog) return cachedCatalog.name;
    
    const docRef = doc(db, 'catalogs', catalogId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data().name as string) : 'Catálogo';
  };

  const handleAddToCart = async (item: ItemWithTimestamp) => {
    if (!item.createdAt) {
        toast({
            title: "Error",
            description: "Este producto no se puede añadir al carrito porque le falta información esencial.",
            variant: "destructive",
        });
        return;
    }
    const price = Math.floor(Math.random() * 100) + 10;
    const catalogName = await getCatalogName(item.catalogId);
    addToCart({ ...item, price, quantity: 1, createdAt: item.createdAt, catalogName }, item.catalogId);
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
  
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag('all');
  };

  const renderItemCard = (item: ItemWithTimestamp, index: number) => {
    const itemInCart = cart.find(cartItem => cartItem.id === item.id);
    return (
        <Card key={item.id} className="group flex flex-col overflow-hidden rounded-lg border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader className="p-0">
            <div className="aspect-video relative bg-muted overflow-hidden">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name || 'Imagen del producto'}
                  className="transition-transform duration-300 group-hover:scale-105 w-full h-full object-cover"
                  data-ai-hint="product photo"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://placehold.co/400x300.png`;
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
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Todos los Productos</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Explora nuestro catálogo completo. Usa la búsqueda y los filtros para encontrar lo que necesitas.</p>
      </div>

       {/* Featured Items Carousel */}
      {!isLoading && featuredItems.length > 0 && (
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
                                    <Card className="group relative w-full h-full aspect-video overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl">
                                        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                                        {itemInCart ? (
                                            <div className="flex items-center justify-center gap-2 rounded-full bg-background/80 p-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground hover:bg-white/80" onClick={() => handleDecreaseQuantity(item.id)}>
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <span className="font-bold text-base w-6 text-center text-foreground">{itemInCart.quantity}</span>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground hover:bg-white/80" onClick={() => handleIncreaseQuantity(item.id)}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="default" size="sm" onClick={() => handleAddToCart(item)}>
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
                                                loading="lazy"
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
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/60 p-4 flex flex-col justify-center items-center text-center">
                                            <CardTitle className="text-2xl font-bold text-white shadow-black [text-shadow:0_2px_4px_var(--tw-shadow-color)] line-clamp-2">{item.name}</CardTitle>
                                            <CardDescription className="text-white/90 text-base mt-2 [text-shadow:0_1px_2px_var(--tw-shadow-color)] line-clamp-3">{item.description}</CardDescription>
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


      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10"
            disabled={isLoading}
          />
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedTag} onValueChange={setSelectedTag} disabled={isLoading || allTags.length === 0}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <SelectValue placeholder="Filtrar por etiqueta" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etiquetas</SelectItem>
              {allTags.map(tag => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchQuery || (selectedTag && selectedTag !== 'all')) && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
          )}
        </div>
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
          <p className="text-sm text-muted-foreground">Por favor, inténtalo de nuevo más tarde.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => queryClient.refetchQueries({ queryKey: ['allItems'] })}>
            Intentar de Nuevo
          </Button>
        </div>
      )}

      {!isLoading && !error && items && items.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No se encontraron productos</h3>
          <p className="text-muted-foreground mb-4">Parece que aún no hay productos disponibles en la tienda.</p>
          <Link href="/">
            <Button>Volver a la Gestión</Button>
          </Link>
        </div>
      )}

      {!isLoading && !error && filteredItems.length === 0 && (searchQuery || (selectedTag && selectedTag !== 'all')) && (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No se encontraron resultados</h3>
          <p className="text-muted-foreground mb-4">No hay productos que coincidan con tu búsqueda o filtro.</p>
          <Button variant="outline" onClick={clearFilters}>
            Limpiar Filtros
          </Button>
        </div>
      )}

      {!isLoading && !error && filteredItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 items-stretch">
          {filteredItems.map(renderItemCard)}
        </div>
      )}
    </div>
  );
}
