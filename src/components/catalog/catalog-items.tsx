"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Item } from "@/types";
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

interface CatalogItemsProps {
  catalogId: string;
}

export function CatalogItems({ catalogId }: CatalogItemsProps) {
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
   const [showDeleteDialog, setShowDeleteDialog] = useState(false);
   const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch items for the selected catalog
  const { data: items, isLoading: isLoadingItems, error: itemsError } = useQuery<Item[]>({
    queryKey: ['items', catalogId], // Include catalogId in the query key
    queryFn: async () => {
      if (!catalogId) return []; // Don't fetch if no catalogId
      const q = query(
          collection(db, "items"),
          where("catalogId", "==", catalogId),
          orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Item[];
    },
    enabled: !!catalogId, // Only run query if catalogId is available
    // staleTime: 1000 * 60 * 2, // Refetch every 2 minutes
  });

   // Fetch catalog details (optional, if needed for title/description)
    const { data: catalogDetails } = useQuery<Omit<Item, 'id'> & { id: string } | null>({
        queryKey: ['catalog', catalogId],
        queryFn: async () => {
            if (!catalogId) return null;
            const { getDoc } = await import("firebase/firestore");
            const docRef = doc(db, "catalogs", catalogId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as any) : null;
        },
        enabled: !!catalogId,
        // staleTime: Infinity, // Catalog details likely don't change often
    });


  // Mutation for adding an item
  const addItemMutation = useMutation({
    mutationFn: async ({ data, catalogId }: { data: ItemFormValues, catalogId: string }) => {
       const newItem: Omit<Item, 'id' | 'createdAt'> = {
            ...data,
            catalogId: catalogId,
            createdAt: serverTimestamp() as any, // Temporary cast until Firestore types are updated
        };
      const docRef = await addDoc(collection(db, "items"), newItem);
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', catalogId] });
      toast({
        title: "Item Added",
        description: "The new item has been added to the catalog.",
        variant: "default",
      });
      setShowItemForm(false);
      setEditingItem(null);
    },
    onError: (error) => {
      console.error("Error adding item: ", error);
       toast({
         title: "Error",
         description: "Could not add item. Please try again.",
         variant: "destructive",
       });
    },
  });

  // Mutation for updating an item
    const updateItemMutation = useMutation({
        mutationFn: async ({ id, data, catalogId }: { id: string, data: ItemFormValues, catalogId: string }) => {
            const itemRef = doc(db, "items", id);
            // Ensure catalogId is not overwritten if it's not in ItemFormValues
            const updateData = { ...data };
            await updateDoc(itemRef, updateData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items', catalogId] });
            toast({
                title: "Item Updated",
                description: "The item has been saved.",
                 variant: "default",
            });
            setShowItemForm(false);
            setEditingItem(null);
        },
        onError: (error) => {
            console.error("Error updating item: ", error);
            toast({
                title: "Error",
                description: "Could not update item.",
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
         title: "Item Deleted",
         description: "The item has been removed from the catalog.",
       });
       setItemToDelete(null);
       setShowDeleteDialog(false);
     },
     onError: (error) => {
       console.error("Error deleting item: ", error);
       toast({
         title: "Error",
         description: "Could not delete item.",
         variant: "destructive",
       });
       setItemToDelete(null);
       setShowDeleteDialog(false);
     },
   });


   const handleAddItem = async (data: ItemFormValues, currentCatalogId: string) => {
        await addItemMutation.mutateAsync({ data, catalogId: currentCatalogId });
    };

   const handleUpdateItem = async (data: ItemFormValues, currentCatalogId: string) => {
        if (editingItem?.id) {
            await updateItemMutation.mutateAsync({ id: editingItem.id, data, catalogId: currentCatalogId });
        }
    };

    const handleEditItem = (item: Item) => {
        setEditingItem(item);
        setShowItemForm(true); // Show form for editing
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
         <div>
           <h1 className="text-2xl font-bold text-primary">{catalogDetails?.name || "Catalog Items"}</h1>
           {catalogDetails?.description && <p className="text-muted-foreground mt-1">{catalogDetails.description}</p>}
        </div>
        <Button onClick={() => { setEditingItem(null); setShowItemForm(true); }} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
        </Button>
      </div>

      {showItemForm && (
        <div className="max-w-2xl mx-auto relative">
          <Button variant="ghost" size="sm" onClick={handleCancelForm} className="absolute top-4 right-4 z-10">Cancel</Button>
          <ItemForm
            catalogId={catalogId}
            onSubmit={editingItem ? handleUpdateItem : handleAddItem}
            initialData={editingItem ?? undefined}
            isLoading={addItemMutation.isPending || updateItemMutation.isPending}
            key={editingItem?.id || 'new-item'} // Force re-render form when editing different item
          />
        </div>
      )}

      {isLoadingItems && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                         <Skeleton className="h-6 w-3/4" />
                          <Skeleton className="h-4 w-1/2 mt-1" />
                    </CardHeader>
                    <CardContent>
                         <Skeleton className="h-10 w-full mb-2" />
                         <Skeleton className="h-4 w-20" />
                    </CardContent>
                     <CardFooter className="flex justify-between">
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
            <p>Error loading items. Please try again later.</p>
         </div>
        )}

      {!isLoadingItems && !itemsError && items && items.length === 0 && !showItemForm && (
        <div className="text-center py-10 border border-dashed rounded-lg">
          <h3 className="text-lg font-medium text-muted-foreground">No items yet</h3>
          <p className="text-muted-foreground mb-4">Add your first item to this catalog!</p>
           <Button onClick={() => { setEditingItem(null); setShowItemForm(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
        </div>
      )}

      {!isLoadingItems && !itemsError && items && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col">
               <CardHeader>
                <div className="aspect-video relative bg-muted rounded-md overflow-hidden mb-4">
                     {item.imageUrl ? (
                        <Image
                           src={item.imageUrl}
                           alt={item.name}
                           fill
                           sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                           style={{ objectFit: 'cover' }}
                           priority={items.indexOf(item) < 3} // Prioritize loading images for the first few items
                           data-ai-hint="product photo" // Hint for AI image generation if needed
                         />
                      ) : (
                         <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                           <ImageOff size={48} />
                         </div>
                       )}
                 </div>
                 <CardTitle>{item.name}</CardTitle>

              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription className="mb-3 line-clamp-3">{item.description}</CardDescription>
                <div className="flex flex-wrap gap-1">
                  {item.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                 <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                  <Edit className="mr-1 h-3 w-3" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(item.id)}>
                   <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>

              </CardFooter>
            </Card>
          ))}
        </div>
      )}

       {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the item.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
                onClick={() => {
                if (itemToDelete) {
                    deleteItemMutation.mutate(itemToDelete);
                }
                }}
                disabled={deleteItemMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
                {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
