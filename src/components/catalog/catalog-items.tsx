
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc, getDoc } from "firebase/firestore"; // Added getDoc
import { db } from "@/lib/firebase";
import type { Catalog, Item } from "@/types"; // Added Catalog type
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
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

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
    const { data: catalogDetails, isLoading: isLoadingCatalogDetails } = useQuery<Catalog | null>({ // Correct type to Catalog
        queryKey: ['catalog', catalogId],
        queryFn: async () => {
            if (!catalogId) return null;
            // Removed unnecessary import
            const docRef = doc(db, "catalogs", catalogId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Catalog) : null; // Cast to Catalog
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
            // Firestore SDK handles timestamp on server, no need for client-side serverTimestamp() here
            // createdAt: serverTimestamp() as any,
        };
      const docRef = await addDoc(collection(db, "items"), {
           ...newItem,
           createdAt: serverTimestamp(), // Add timestamp during doc creation
        });
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
            // Omit catalogId and createdAt from the update data as they shouldn't be changed here
            const { catalogId: _catalogId, createdAt: _createdAt, ...updateData } = data as ItemFormValues & { catalogId?: string; createdAt?: any };
            await updateDoc(itemRef, updateData);
        },
        onSuccess: (_, variables) => { // Use variables to access mutation args
            queryClient.invalidateQueries({ queryKey: ['items', variables.catalogId] }); // Use catalogId from variables
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
         <div className="flex-1"> {/* Allow title/description to take space */}
           {isLoadingCatalogDetails ? (
                <Skeleton className="h-8 w-3/4 mb-1" /> // Skeleton for title
           ) : (
               <h1 className="text-xl sm:text-2xl font-bold text-primary break-words"> {/* Responsive text size and word break */}
                 {catalogDetails?.name || "Catalog Items"}
               </h1>
           )}
            {isLoadingCatalogDetails ? (
                <Skeleton className="h-4 w-1/2 mt-1" /> // Skeleton for description
            ) : (
                catalogDetails?.description && <p className="text-muted-foreground mt-1 text-sm sm:text-base">{catalogDetails.description}</p> // Responsive text size
            )}
        </div>
        <Button onClick={() => { setEditingItem(null); setShowItemForm(true); }} className="w-full sm:w-auto flex-shrink-0"> {/* Prevent button shrinking too much */}
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
        </Button>
      </div>

      {showItemForm && (
        <div className="max-w-full md:max-w-2xl mx-auto relative"> {/* Responsive max-width */}
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
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Responsive grid */}
            {[...Array(3)].map((_, i) => (
                 <Card key={i} className="flex flex-col">
                    <CardHeader>
                        <Skeleton className="aspect-video w-full mb-4" /> {/* Image skeleton */}
                        <Skeleton className="h-6 w-3/4" /> {/* Title skeleton */}
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <Skeleton className="h-4 w-full mb-1" /> {/* Description skeleton */}
                        <Skeleton className="h-4 w-2/3 mb-3" /> {/* Description skeleton */}
                         <div className="flex flex-wrap gap-1">
                            <Skeleton className="h-5 w-16 rounded-full" /> {/* Tag skeleton */}
                            <Skeleton className="h-5 w-12 rounded-full" /> {/* Tag skeleton */}
                         </div>
                    </CardContent>
                     <CardFooter className="flex justify-end gap-2"> {/* Adjusted footer alignment */}
                         <Skeleton className="h-8 w-16" /> {/* Button skeleton */}
                         <Skeleton className="h-8 w-16" /> {/* Button skeleton */}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"> {/* Responsive grid and gap */}
          {items.map((item, index) => ( // Added index
            <Card key={item.id} className="flex flex-col overflow-hidden"> {/* Added overflow-hidden */}
               <CardHeader className="p-0"> {/* Remove padding for full-width image */}
                <div className="aspect-video relative bg-muted overflow-hidden"> {/* Removed rounded-md here, apply to card */}
                     {item.imageUrl ? (
                        <Image
                           src={item.imageUrl}
                           alt={item.name}
                           fill
                           sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" // Adjusted sizes
                           style={{ objectFit: 'cover' }}
                           priority={index < 3} // Prioritize loading images for the first few items
                           data-ai-hint="product photo" // Hint for AI image generation if needed
                           onError={(e) => { e.currentTarget.src = 'https://picsum.photos/400/300?blur=2'; e.currentTarget.srcset = '' }} // Basic fallback
                         />
                      ) : (
                         <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted via-background to-muted"> {/* Placeholder background */}
                           <ImageOff size={36} /> {/* Slightly smaller icon */}
                         </div>
                       )}
                 </div>
              </CardHeader>
              <CardContent className="flex-grow p-4"> {/* Adjusted padding */}
                 <CardTitle className="text-base sm:text-lg mb-1 line-clamp-1">{item.name}</CardTitle> {/* Responsive title size, clamp */}
                 <CardDescription className="text-xs sm:text-sm mb-3 line-clamp-3">{item.description}</CardDescription> {/* Responsive description */}
                 <div className="flex flex-wrap gap-1">
                   {item.tags?.slice(0, 5).map((tag) => ( // Limit tags displayed initially
                     <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                   ))}
                   {item.tags?.length > 5 && ( // Show indicator if more tags exist
                       <Badge variant="outline" className="text-xs">...</Badge>
                   )}
                 </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 p-4 border-t"> {/* Add border, adjust padding */}
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
