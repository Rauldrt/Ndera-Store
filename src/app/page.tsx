
"use client";

import React, { useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PlusCircle, LayoutGrid, Trash2, AlertTriangle, Edit, Loader2, Plus } from "lucide-react";
import { CatalogForm } from "@/components/catalog/catalog-form";
import type { Catalog } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc, getDocs, Timestamp } from "firebase/firestore"; // Import necessary functions and Timestamp
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useToast } from "@/hooks/use-toast";
import { CatalogItems } from '@/components/catalog/catalog-items';
import { Skeleton } from '@/components/ui/skeleton';
import { Fab } from '@/components/ui/fab';

// Define the type for the data returned by the query, ensuring createdAt is handled
interface CatalogWithTimestamp extends Omit<Catalog, 'createdAt'> {
    createdAt: Timestamp | null; // Firestore timestamp or null if pending
}


export default function Home() {
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [catalogToDelete, setCatalogToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch catalogs using TanStack Query
  const { data: catalogs, isLoading: isLoadingCatalogs, error: catalogsError } = useQuery<Catalog[]>({ // Use Catalog type
    queryKey: ['catalogs'],
    queryFn: async () => {
        const q = query(collection(db, "catalogs"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        // Map Firestore docs to Catalog type, ensuring createdAt is handled correctly
        return querySnapshot.docs.map(doc => {
             const data = doc.data() as Omit<Catalog, 'id'>; // Cast data
             return {
                id: doc.id,
                ...data,
                // createdAt will be a Firestore Timestamp object
            } as Catalog; // Assert final type
        });
    },
    // Optional: Add staleTime or refetchInterval as needed
    // staleTime: 1000 * 60 * 5, // Refetch every 5 minutes
  });

  // Mutation for adding a catalog
  const addCatalogMutation = useMutation({
    // Define the mutation function type explicitly
    mutationFn: async (newCatalogData: Pick<Catalog, 'name' | 'description'>): Promise<string> => {
        const docRef = await addDoc(collection(db, "catalogs"), {
            ...newCatalogData,
            createdAt: serverTimestamp(), // Use serverTimestamp for creation time
        });
        return docRef.id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast({
        title: "Catalog Created",
        description: "Your new catalog has been added.",
        variant: "default",
      });
      setShowCatalogForm(false);
      setEditingCatalog(null); // Clear editing state
      setSelectedCatalogId(newId); // Select the newly created catalog
    },
    onError: (error) => {
      console.error("Error adding catalog: ", error);
      toast({
        title: "Error",
        description: "Could not create catalog. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating a catalog
  const updateCatalogMutation = useMutation({
      mutationFn: async ({ id, data }: { id: string, data: Partial<Pick<Catalog, 'name' | 'description'>> }) => {
          const catalogRef = doc(db, "catalogs", id);
          // Only update name and description, createdAt should not be updated here
          await updateDoc(catalogRef, data);
      },
      onSuccess: (_, variables) => {
          queryClient.invalidateQueries({ queryKey: ['catalogs'] });
          queryClient.invalidateQueries({ queryKey: ['catalog', variables.id] }); // Invalidate specific catalog query if exists
          toast({
              title: "Catalog Updated",
              description: "Your catalog has been saved.",
              variant: "default",
          });
          setEditingCatalog(null); // Close form/modal
          setShowCatalogForm(false); // Hide form after update
          setSelectedCatalogId(variables.id); // Reselect the updated catalog
      },
      onError: (error) => {
          console.error("Error updating catalog: ", error);
          toast({
              title: "Error",
              description: "Could not update catalog.",
              variant: "destructive",
          });
      },
  });

  // Mutation for deleting a catalog
  const deleteCatalogMutation = useMutation({
    mutationFn: async (catalogId: string) => {
       // **Important:** Deleting a catalog should ideally also delete all items within it.
       // This requires either:
       // 1. Fetching all items first and deleting them individually (less efficient, potential race conditions).
       // 2. Using Firebase Cloud Functions for cascading deletes (recommended for production).
       // For this example, we only delete the catalog document. Implement item deletion as needed.
       console.warn(`Deleting catalog ${catalogId}. Items within this catalog are NOT automatically deleted in this example implementation.`);
       await deleteDoc(doc(db, "catalogs", catalogId));
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      queryClient.removeQueries({ queryKey: ['items', deletedId] }); // Remove items query cache for the deleted catalog
      queryClient.removeQueries({ queryKey: ['catalog', deletedId] }); // Remove catalog details query cache
      // If the deleted catalog was selected, reset selection
      if (selectedCatalogId === deletedId) {
        setSelectedCatalogId(null);
      }
      toast({
        title: "Catalog Deleted",
        description: "The catalog has been removed.",
      });
      setCatalogToDelete(null); // Close dialog
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      console.error("Error deleting catalog: ", error);
       toast({
         title: "Error",
         description: "Could not delete catalog.",
         variant: "destructive",
       });
       setCatalogToDelete(null);
       setShowDeleteDialog(false);
    },
  });


  const handleCreateCatalog = async (data: Pick<Catalog, 'name' | 'description'>) => {
    addCatalogMutation.mutate(data);
  };

   const handleUpdateCatalog = async (data: Pick<Catalog, 'name' | 'description'>) => {
        if (editingCatalog?.id) {
            updateCatalogMutation.mutate({ id: editingCatalog.id, data });
        }
    };

  const openDeleteDialog = (id: string) => {
    setCatalogToDelete(id);
    setShowDeleteDialog(true);
  };


  const handleSelectCatalog = (id: string) => {
      setSelectedCatalogId(id);
      setShowCatalogForm(false); // Hide form when selecting
      setEditingCatalog(null); // Hide edit form
  }

  const handleEditCatalog = (catalog: Catalog) => {
      setEditingCatalog(catalog);
      setSelectedCatalogId(null); // Deselect item view
      setShowCatalogForm(true); // Show form for editing
  }

  const handleOpenCreateForm = () => {
    setShowCatalogForm(true);
    setSelectedCatalogId(null);
    setEditingCatalog(null);
  }

  const handleCancelForm = () => {
       setEditingCatalog(null);
       setShowCatalogForm(false);
        // Optional: Re-select the previously selected catalog if desired
        // const previouslySelected = queryClient.getQueryData<Catalog[]>(['catalogs'])?.find(c => c.id === selectedCatalogId);
        // if (previouslySelected) setSelectedCatalogId(previouslySelected.id);
   }


  return (
    <SidebarProvider>
      <Sidebar collapsible="icon"> {/* Ensure collapsible is set */}
        <SidebarHeader className="items-center justify-between p-2">
          <h2 className="text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden">Catalogify</h2>
          <div className="flex items-center gap-1">
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <Button
            variant="default"
            className="w-full mb-4"
            onClick={handleOpenCreateForm}
            title="Create New Catalog"
          >
            <PlusCircle className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
             <span className="group-data-[collapsible=icon]:hidden">Create Catalog</span>
          </Button>
          <SidebarMenu>
            {isLoadingCatalogs && (
               <>
                 <SidebarMenuSkeleton showIcon />
                 <SidebarMenuSkeleton showIcon />
                 <SidebarMenuSkeleton showIcon />
               </>
            )}
            {catalogsError && (
              <SidebarMenuItem className="text-destructive px-2 py-1 text-xs">
                <AlertTriangle className="inline-block mr-2 h-4 w-4"/> Error loading.
              </SidebarMenuItem>
            )}
            {catalogs && catalogs.map((catalog) => (
              <SidebarMenuItem key={catalog.id}>
                 <div className="relative group/menu-item flex items-center">
                    <SidebarMenuButton
                        isActive={selectedCatalogId === catalog.id}
                        onClick={() => handleSelectCatalog(catalog.id)}
                        tooltip={{ children: catalog.name, side: 'right', align: 'center' }}
                        className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap pr-12"
                    >
                        <LayoutGrid />
                        <span>{catalog.name}</span>
                    </SidebarMenuButton>
                     <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex gap-0.5 opacity-0 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100 transition-opacity group-data-[collapsible=icon]:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); handleEditCatalog(catalog); }}
                            title={`Edit ${catalog.name}`}
                        >
                           <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive/90"
                            onClick={(e) => { e.stopPropagation(); openDeleteDialog(catalog.id); }}
                            title={`Delete ${catalog.name}`}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                 </div>
              </SidebarMenuItem>
            ))}
             {catalogs && catalogs.length === 0 && !isLoadingCatalogs && !showCatalogForm && (
                <p className="px-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">No catalogs yet. Create one!</p>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if needed */}
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {showCatalogForm ? (
             <div className="mb-6 max-w-full md:max-w-2xl mx-auto relative">
             <Button variant="ghost" size="sm" onClick={handleCancelForm} className="absolute top-4 right-4 z-10">Cancel</Button>
              <CatalogForm
                 onSubmit={editingCatalog ? handleUpdateCatalog : handleCreateCatalog}
                 initialData={editingCatalog ?? undefined}
                 // Use mutation pending state for loading indicator
                 isLoading={addCatalogMutation.isPending || updateCatalogMutation.isPending}
                 key={editingCatalog?.id || 'new'} // Re-render form when editing changes
              />
            </div>
          ) : selectedCatalogId ? (
             <CatalogItems catalogId={selectedCatalogId} />
          ) : (
            // Placeholder content when no catalog is selected
            <>
              {isLoadingCatalogs && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Loader2 className="w-16 h-16 text-muted-foreground mb-4 animate-spin" />
                  <p className="text-muted-foreground">Loading catalogs...</p>
                </div>
              )}
              {!isLoadingCatalogs && catalogs && catalogs.length > 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                    <LayoutGrid className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold text-muted-foreground">Select a catalog</h2>
                    <p className="text-muted-foreground text-sm md:text-base">Choose a catalog from the sidebar to view its items, or create a new one.</p>
                </div>
              )}
              {!isLoadingCatalogs && catalogs && catalogs.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                    <PlusCircle className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold text-muted-foreground">Welcome to Catalogify!</h2>
                    <p className="text-muted-foreground text-sm md:text-base">Get started by creating your first catalog using the button in the sidebar.</p>
                </div>
              )}
               {!isLoadingCatalogs && catalogsError && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-destructive">
                    <AlertTriangle className="w-12 h-12 md:w-16 md:h-16 mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold">Error Loading Catalogs</h2>
                    <p className="text-sm md:text-base">Could not fetch your catalogs. Please check your connection and try again.</p>
                </div>
              )}
            </>
          )}
        </main>

        {/* Floating Action Button - only on small screens */}
        <Fab
            className="md:hidden fixed bottom-4 right-4 z-30"
            onClick={handleOpenCreateForm}
            aria-label="Create New Catalog"
        >
            <Plus className="h-6 w-6" />
        </Fab>

      </SidebarInset>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the catalog.
                {/* Add warning about items not being deleted automatically */}
                <span className="font-semibold block mt-2">Items within this catalog will NOT be deleted automatically in this version.</span>
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCatalogToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
                onClick={() => {
                if (catalogToDelete) {
                    deleteCatalogMutation.mutate(catalogToDelete);
                }
                }}
                disabled={deleteCatalogMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
                {deleteCatalogMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {deleteCatalogMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </SidebarProvider>
  );
}
