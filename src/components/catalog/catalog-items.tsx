
"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc, getDoc, Timestamp } from "firebase/firestore"; // Import Timestamp
import { db } from "@/lib/firebase";
import type { Catalog, Item } from "@/types";
import { ItemForm, type ItemFormValues } from '@/components/item/item-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Edit, AlertTriangle, ImageOff, Loader2, Search, Star } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Separator } from '@/components/ui/separator';

interface CatalogItemsProps {
  catalogId: string;
}

// Define the type for item data from Firestore
interface ItemWithTimestamp extends Omit<Item, 'createdAt'> {
    createdAt: Timestamp | null; // Firestore timestamp or null if pending
}


export function CatalogItems({ catalogId }: CatalogItemsProps) {
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemWithTimestamp | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch items for the selected catalog
  const { data: itemsWithTimestamp, isLoading: isLoadingItems, error: itemsError } = useQuery<ItemWithTimestamp[] | undefined>({
    queryKey: ['items', catalogId], // Include catalogId in the query key
    queryFn: async () => {
      if (!catalogId) {
        return undefined;
      }
      const q = query(collection(db, "items"), where("catalogId", "==", catalogId), orderBy("createdAt", "desc"));
      try {
        const querySnapshot = await getDocs(q);
        // Map Firestore docs to Item type
        return querySnapshot.docs.map(doc => {
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
      } catch (error) {
        console.error(`[CatalogItems] queryFn: Error fetching items for catalogId ${catalogId}:`, error);
        toast({
          title: "Error al Cargar Productos",
          description: (error as Error)?.message || "No se pudieron cargar los productos. Revisa la consola para más detalles.",
          variant: "destructive",
        });
        throw error; // Ensure react-query catches this and sets itemsWithTimestampError
      }
    },
    enabled: !!catalogId, // Only run query if catalogId is available
  });

  const { featuredItems, regularItems, filteredRegularItems } = useMemo(() => {
    if (!itemsWithTimestamp) {
      return { featuredItems: [], regularItems: [], filteredRegularItems: [] };
    }
    
    const featured = itemsWithTimestamp.filter(item => item.isFeatured);
    const regular = itemsWithTimestamp.filter(item => !item.isFeatured);

    if (!searchQuery.trim()) {
      return { featuredItems: featured, regularItems: regular, filteredRegularItems: regular };
    }

    const query = searchQuery.toLowerCase();
    const filteredRegular = regular.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      (Array.isArray(item.tags) && item.tags.some(tag => tag.toLowerCase().includes(query)))
    );

    return { featuredItems: featured, regularItems: regular, filteredRegularItems: filteredRegular };
  }, [itemsWithTimestamp, searchQuery]);


   // Fetch catalog details (for title/description)
    const { data: catalogDetails, isLoading: isLoadingCatalogDetails } = useQuery<Catalog | null>({
        queryKey: ['catalog', catalogId],
        queryFn: async () => {
            if (!catalogId) return null;
            const docRef = doc(db, "catalogs", catalogId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                 const data = docSnap.data() as Omit<Catalog, 'id'>;
                 return { id: docSnap.id, ...data } as Catalog;
            } else {
                console.error(`Catálogo con ID ${catalogId} no encontrado.`);
                return null;
            }
        },
        enabled: !!catalogId,
    });


  // Mutation for adding an item
  const addItemMutation = useMutation({
    mutationFn: async ({ data, catalogId: currentCatalogId }: { data: ItemFormValues, catalogId: string }): Promise<string> => {
        const newItemData: Omit<Item, 'id' | 'createdAt'> & { catalogId: string } = {
            name: data.name,
            description: data.description,
            imageUrl: data.imageUrl,
            tags: Array.isArray(data.tags) ? data.tags : [],
            catalogId: currentCatalogId,
            isFeatured: data.isFeatured,
        };
        const docRef = await addDoc(collection(db, "items"), {
           ...newItemData,
            createdAt: serverTimestamp(),
        });
      return docRef.id;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['items', catalogId] });
        toast({
            title: "Producto Añadido",
            description: "El nuevo producto ha sido añadido al catálogo.",
            variant: "default",
        });
      setShowItemForm(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      let description = "No se pudo añadir el producto. Por favor, inténtalo de nuevo.";
      if (error instanceof Error) {
        description = error.message;
      }
       toast({
         title: "Error al Añadir Producto",
         description: description,
         variant: "destructive",
       });
    },
  });

  // Mutation for updating an item
    const updateItemMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: ItemFormValues }) => { 
            const itemRef = doc(db, "items", id);
             const updateData: Partial<Omit<Item, 'id' | 'createdAt' | 'catalogId'>> = {
                name: data.name,
                description: data.description,
                imageUrl: data.imageUrl,
                tags: Array.isArray(data.tags) ? data.tags : [],
                isFeatured: data.isFeatured,
            };
            await updateDoc(itemRef, updateData);
        },
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ['items', catalogId] });
            toast({
                title: "Producto Actualizado",
                description: "El producto ha sido guardado.",
                 variant: "default",
            });
            setShowItemForm(false);
            setEditingItem(null);
        },
        onError: (error: any) => {
            let description = "No se pudo actualizar el producto. Por favor, inténtalo de nuevo.";
            if (error instanceof Error) {
                description = error.message;
            }
            toast({
                title: "Error al Actualizar Producto",
                description: description,
                variant: "destructive",
            });
        },
    });


   // Mutation for deleting an item
   const deleteItemMutation = useMutation({
     mutationFn: async (itemId: string) => {
       await deleteDoc(doc(db, "items", itemId));
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['items', catalogId] });
       toast({
         title: "Producto Eliminado",
         description: "El producto ha sido eliminado del catálogo.",
       });
       setItemToDelete(null);
       setShowDeleteDialog(false);
     },
     onError: (error) => {
       toast({
         title: "Error al Eliminar Producto",
         description: (error as Error)?.message || "No se pudo eliminar el producto.",
         variant: "destructive",
       });
       setItemToDelete(null);
       setShowDeleteDialog(false);
     },
   });


   const handleAddItem = async (data: ItemFormValues) => {
        await addItemMutation.mutateAsync({ data, catalogId });
    };

   const handleUpdateItem = async (data: ItemFormValues) => {
        if (editingItem?.id) {
            await updateItemMutation.mutateAsync({ id: editingItem.id, data });
        }
    };

    const handleEditItem = (item: ItemWithTimestamp) => {
        setEditingItem(item);
        setShowItemForm(true);
    }

    const openDeleteDialog = (id: string) => {
        setItemToDelete(id);
        setShowDeleteDialog(true);
    };

    const handleCancelForm = () => {
        setShowItemForm(false);
        setEditingItem(null);
    }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div className="flex-1">
           {isLoadingCatalogDetails ? (
                <Skeleton className="h-8 w-3/4 mb-1" />
           ) : (
               <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">
                 {catalogDetails?.name || "Productos del Catálogo"}
               </h1>
           )}
            {isLoadingCatalogDetails ? (
                <Skeleton className="h-4 w-1/2 mt-1" />
            ) : (
                catalogDetails?.description && <p className="text-muted-foreground mt-1 text-sm sm:text-base">{catalogDetails.description}</p>
            )}
        </div>
        <Button onClick={() => { setEditingItem(null); setShowItemForm(true); }} className="w-full sm:w-auto flex-shrink-0">
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Nuevo Producto
        </Button>
      </div>

      <Dialog open={showItemForm} onOpenChange={(isOpen) => {
          setShowItemForm(isOpen);
          if (!isOpen) handleCancelForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Producto' : 'Añadir Producto'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Modifica el producto en este formulario.' : 'Añade un nuevo producto usando este formulario.'}
            </DialogDescription>
          </DialogHeader>
          <ItemForm
            catalogId={catalogId}
            onSubmit={editingItem ? handleUpdateItem : handleAddItem}
            initialData={editingItem ? {
              ...editingItem,
              createdAt: editingItem.createdAt ? new Date(editingItem.createdAt.seconds * 1000 + (editingItem.createdAt.nanoseconds || 0) / 1000000) : undefined,
            } as Partial<Item> : {}} 
            isLoading={addItemMutation.isPending || updateItemMutation.isPending}
            key={editingItem?.id || 'new-item'}
          />
        </DialogContent>
      </Dialog>
      
      {/* Featured Items Carousel */}
      {!isLoadingItems && featuredItems.length > 0 && (
        <div className='space-y-4'>
            <div className='flex items-center gap-2'>
              <Star className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-foreground">Productos Destacados</h2>
            </div>
            <Carousel
                opts={{
                    align: "start",
                    loop: featuredItems.length > 3,
                }}
                className="w-full"
            >
                <CarouselContent>
                    {featuredItems.map((item, index) => (
                        <CarouselItem key={item.id} className="md:basis-1/2 lg:basis-1/3">
                            <div className="p-1 h-full">
                                <Card className="group relative w-full h-full aspect-video overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl">
                                    <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/70 hover:bg-background" onClick={() => handleEditItem(item)}>
                                            <Edit className="h-4 w-4" />
                                            <span className="sr-only">Edit Item</span>
                                        </Button>
                                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => openDeleteDialog(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete Item</span>
                                        </Button>
                                    </div>
                                    {item.imageUrl ? (
                                        <Image
                                            src={item.imageUrl}
                                            alt={item.name || 'Imagen del producto'}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
                                            data-ai-hint="product photo"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = `https://placehold.co/400x300.png`;
                                                target.srcset = '';
                                                target.dataset.aiHint = "placeholder image";
                                            }}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted via-background to-muted">
                                            <ImageOff size={48} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 flex flex-col justify-end">
                                        <CardTitle className="text-lg font-bold text-white shadow-black [text-shadow:0_2px_4px_var(--tw-shadow-color)] line-clamp-2">{item.name}</CardTitle>
                                        <CardDescription className="text-white/90 text-sm mt-1 [text-shadow:0_1px_2px_var(--tw-shadow-color)] line-clamp-2">{item.description}</CardDescription>
                                    </div>
                                </Card>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex" />
                <CarouselNext className="hidden sm:flex" />
            </Carousel>
            <Separator className="my-6" />
        </div>
      )}
      
      {/* Search and Regular Items */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
            type="search"
            placeholder="Buscar en este catálogo por nombre, descripción o etiqueta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10"
            disabled={isLoadingItems}
        />
      </div>

      {isLoadingItems && (
         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
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
                     <CardFooter className="flex justify-end gap-2">
                         <Skeleton className="h-8 w-16" />
                         <Skeleton className="h-8 w-16" />
                    </CardFooter>
                </Card>
            ))}
         </div>
      )}
       {itemsError && (
         <div className="text-center text-destructive py-10">
            <AlertTriangle className="mx-auto h-12 w-12 mb-4"/>
            <p className="font-semibold">Error al cargar los productos.</p>
            <p className="text-sm text-muted-foreground">Por favor, inténtalo de nuevo más tarde o revisa la consola para más detalles. Podría ser necesario un índice de Firestore.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => queryClient.refetchQueries({ queryKey: ['items', catalogId] })}>
              Intentar de Nuevo
            </Button>
         </div>
        )}

      {!isLoadingItems && !itemsError && itemsWithTimestamp && itemsWithTimestamp.length === 0 && !showItemForm && (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-medium text-muted-foreground">Aún no hay productos</h3>
          <p className="text-muted-foreground mb-4">¡Añade tu primer producto a este catálogo!</p>
           <Button onClick={() => { setEditingItem(null); setShowItemForm(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Producto
            </Button>
        </div>
      )}

      {!isLoadingItems && !itemsError && filteredRegularItems.length === 0 && (searchQuery || regularItems.length > 0) && (
         <div className="text-center py-10 border-2 border-dashed rounded-lg">
           <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
           <h3 className="text-lg font-medium text-muted-foreground">No se encontraron resultados</h3>
           <p className="text-muted-foreground mb-4">No hay productos que coincidan con tu búsqueda.</p>
           <Button variant="outline" onClick={() => setSearchQuery("")}>
             Limpiar Búsqueda
           </Button>
         </div>
       )}

      {!isLoadingItems && !itemsError && filteredRegularItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 items-stretch">
          {filteredRegularItems.map((item, index) => (
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
                           priority={index < 8} 
                           className="transition-transform duration-300 group-hover:scale-105"
                           data-ai-hint="product photo"
                           onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = `https://placehold.co/400x300.png`; 
                              target.srcset = '';
                              target.dataset.aiHint = "placeholder image";
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
              <CardFooter className="flex justify-end gap-2 p-3 border-t bg-background/50 opacity-100 group-hover:opacity-100 transition-opacity duration-300">
                 <Button variant="outline" size="sm" onClick={() => handleEditItem(item)} className="flex-1">
                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(item.id)} className="flex-1">
                   <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
)}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
           <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Esto eliminará permanentemente el producto.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
                onClick={() => {
                if (itemToDelete) {
                    deleteItemMutation.mutate(itemToDelete);
                }
                }}
                disabled={deleteItemMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
                 {deleteItemMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {deleteItemMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
