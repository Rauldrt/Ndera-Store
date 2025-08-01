
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc, getDoc, Timestamp } from "firebase/firestore"; // Import Timestamp
import { db } from "@/lib/firebase";
import type { Catalog, Item } from "@/types";
import { ItemForm, type ItemFormValues } from '@/components/item/item-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Edit, AlertTriangle, ImageOff, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';

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

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch items for the selected catalog
  const { data: itemsWithTimestamp, isLoading: isLoadingItemsWithTimestamp, error: itemsWithTimestampError } = useQuery<ItemWithTimestamp[] | undefined>({
    queryKey: ['items', catalogId], // Include catalogId in the query key
    queryFn: async () => {
      if (!catalogId) {
        console.log("[CatalogItems] queryFn: No catalogId, returning undefined.");
        return undefined;
      }
      console.log(`[CatalogItems] queryFn: Fetching items for catalogId: ${catalogId}`);
      const q = query(collection(db, "items"), where("catalogId", "==", catalogId), orderBy("createdAt", "desc"));
      try {
        const querySnapshot = await getDocs(q);
        console.log(`[CatalogItems] queryFn: Fetched ${querySnapshot.docs.length} items for catalogId: ${catalogId}`);
        if (querySnapshot.empty) {
            console.log(`[CatalogItems] queryFn: Snapshot is empty. No items found matching catalogId: ${catalogId}. This might be due to missing Firestore indexes if data exists in DB.`);
        }
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
        // Prepare item data for Firestore, ensuring tags are an array
        const newItemData: Omit<Item, 'id' | 'createdAt'> & { catalogId: string } = {
            name: data.name,
            description: data.description,
            imageUrl: data.imageUrl,
            tags: Array.isArray(data.tags) ? data.tags : [],
            catalogId: currentCatalogId,
        };
        console.log("[CatalogItems] Intentando añadir producto:", JSON.stringify(newItemData, null, 2));
        const docRef = await addDoc(collection(db, "items"), {
           ...newItemData,
            createdAt: serverTimestamp(), // Use Firestore server-side timestamp
        });
        console.log("[CatalogItems] Producto añadido con ID:", docRef.id);
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
      console.error(`[CatalogItems] Error al añadir producto al catálogo '${catalogId}':`, error);
      let description = "No se pudo añadir el producto. Por favor, inténtalo de nuevo.";
      if (error instanceof Error) {
        description = error.message;
      }
      // Check for specific Firebase error codes
      if (error && error.code === 'permission-denied') {
        description = "Permiso denegado. Por favor, revisa las reglas de Firestore para la colección 'items'.";
      } else if (error && error.code) {
        description = `Error: ${error.code} - ${error.message}`;
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
            };
            console.log("[CatalogItems] Intentando actualizar producto:", id, JSON.stringify(updateData, null, 2));
            await updateDoc(itemRef, updateData);
            console.log("[CatalogItems] Producto actualizado:", id);
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
            console.error(`[CatalogItems] Error al actualizar producto:`, error);
            let description = "No se pudo actualizar el producto. Por favor, inténtalo de nuevo.";
            if (error instanceof Error) {
                description = error.message;
            }
            if (error && error.code === 'permission-denied') {
                description = "Permiso denegado. Por favor, revisa las reglas de Firestore para la colección 'items'.";
            } else if (error && error.code) {
                description = `Error: ${error.code} - ${error.message}`;
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
       console.error("[CatalogItems] Error al eliminar producto: ", error);
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
               <h1 className="text-xl sm:text-2xl font-bold text-primary break-words">
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
      {isLoadingItemsWithTimestamp && (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
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
       {itemsWithTimestampError && (
         <div className="text-center text-destructive py-10">
            <AlertTriangle className="mx-auto h-12 w-12 mb-4"/>
            <p className="font-semibold">Error al cargar los productos.</p>
            <p className="text-sm text-muted-foreground">Por favor, inténtalo de nuevo más tarde o revisa la consola para más detalles. Podría ser necesario un índice de Firestore.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => queryClient.refetchQueries({ queryKey: ['items', catalogId] })}>
              Intentar de Nuevo
            </Button>
         </div>
        )}

      {!isLoadingItemsWithTimestamp && !itemsWithTimestampError && itemsWithTimestamp && itemsWithTimestamp.length === 0 && !showItemForm && (
        <div className="text-center py-10 border border-dashed rounded-lg border-muted-foreground/20">
          <h3 className="text-lg font-medium text-muted-foreground">Aún no hay productos</h3>
          <p className="text-muted-foreground mb-4">¡Añade tu primer producto a este catálogo!</p>
           <Button onClick={() => { setEditingItem(null); setShowItemForm(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Producto
            </Button>
        </div>
      )}

      {!isLoadingItemsWithTimestamp && !itemsWithTimestampError && itemsWithTimestamp && itemsWithTimestamp.length > 0 && (

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-stretch">
          {itemsWithTimestamp.map((item, index) => (
            <Card key={item.id} className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 rounded-lg">
               <CardHeader className="p-0">
                <div className="aspect-video relative bg-muted overflow-hidden">
                     {item.imageUrl ? (
                        <Image
                           src={item.imageUrl}
                           alt={item.name || 'Imagen del producto'}
                           fill
                           sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                           style={{ objectFit: 'cover' }}
                           priority={index < 3} 
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
                           <ImageOff size={36} />
                         </div>
                       )}
                 </div>
              </CardHeader>
              <CardContent className="flex-grow p-4">
                 <CardTitle className="text-base sm:text-lg mb-1 line-clamp-1">{item.name}</CardTitle>
                 <CardDescription className="text-xs sm:text-sm mb-3 line-clamp-3 h-12 sm:h-16">{item.description}</CardDescription>
                 <div className="flex flex-wrap gap-1 mt-auto">
                   {Array.isArray(item.tags) && item.tags.slice(0, 5).map((tag) => (
                     <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                   ))}
                   {Array.isArray(item.tags) && item.tags.length > 5 && (
                       <Badge variant="outline" className="text-xs">...</Badge>
                   )}
                 </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 p-4 border-t">
                 <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                  <Edit className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(item.id)}>
                   <Trash2 className="mr-1 h-3 w-3" /> Eliminar
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


    

    