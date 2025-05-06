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
import { PlusCircle, LayoutGrid, Trash2, AlertTriangle } from "lucide-react";
import { CatalogForm } from "@/components/catalog/catalog-form";
import type { Catalog } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
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

export default function Home() {
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [catalogToDelete, setCatalogToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch catalogs using TanStack Query
  const { data: catalogs, isLoading: isLoadingCatalogs, error: catalogsError } = useQuery<Catalog[]>({
    queryKey: ['catalogs'],
    queryFn: async () => {
        const q = query(collection(db, "catalogs"), orderBy("createdAt", "desc"));
        // Note: Replace this with a proper fetch function that handles snapshots and returns data.
        // For simplicity, this example might not fetch real-time updates correctly without onSnapshot.
        // Consider using a library like @tanstack-query-firebase/react for better integration.
        // This is a simplified fetch for demonstration.
        const { getDocs } = await import("firebase/firestore");
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Catalog[];
    },
     // staleTime: 1000 * 60 * 5, // Refetch every 5 minutes
  });

  // Mutation for adding a catalog
  const addCatalogMutation = useMutation({
    mutationFn: async (newCatalog: Omit<Catalog, 'id' | 'createdAt'>) => {
      const docRef = await addDoc(collection(db, "catalogs"), {
        ...newCatalog,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast({
        title: "Catalog Created",
        description: "Your new catalog has been added.",
        variant: "default", // Use accent color (green)
      });
      setShowCatalogForm(false);
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
      mutationFn: async ({ id, data }: { id: string, data: Partial<Catalog> }) => {
          const catalogRef = doc(db, "catalogs", id);
          await updateDoc(catalogRef, data);
      },
      onSuccess: (_, variables) => {
          queryClient.invalidateQueries({ queryKey: ['catalogs'] });
          queryClient.invalidateQueries({ queryKey: ['catalog', variables.id] }); // If you have individual catalog queries
          toast({
              title: "Catalog Updated",
              description: "Your catalog has been saved.",
              variant: "default",
          });
          setEditingCatalog(null); // Close form/modal
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
       // TODO: Also delete all items within this catalog (requires fetching items first or using Cloud Functions)
      await deleteDoc(doc(db, "catalogs", catalogId));
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
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


  const handleCreateCatalog = async (data: { name: string; description?: string }) => {
    addCatalogMutation.mutate(data);
  };

   const handleUpdateCatalog = async (data: { name: string; description?: string }) => {
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

  const handleCancelEdit = () => {
       setEditingCatalog(null);
       setShowCatalogForm(false);
   }


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Catalogify</h2>
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent className="p-2">
          <Button
            variant="default" // Use primary color
            className="w-full mb-4"
            onClick={() => { setShowCatalogForm(true); setSelectedCatalogId(null); setEditingCatalog(null); }}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Create Catalog
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
              <SidebarMenuItem className="text-destructive px-2 py-1">
                <AlertTriangle className="inline-block mr-2 h-4 w-4"/> Error loading catalogs.
              </SidebarMenuItem>
            )}
            {catalogs && catalogs.map((catalog) => (
              <SidebarMenuItem key={catalog.id}>
                <SidebarMenuButton
                    isActive={selectedCatalogId === catalog.id}
                    onClick={() => handleSelectCatalog(catalog.id)}
                    tooltip={catalog.name} // Show full name on hover when collapsed
                >
                  <LayoutGrid />
                  <span>{catalog.name}</span>
                </SidebarMenuButton>
                 {/* Actions visible on hover/focus within the item */}
                 <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity group-data-[collapsible=icon]:hidden">
                    {/* Edit Button */}
                     <Button
                         variant="ghost"
                         size="icon"
                         className="h-6 w-6"
                         onClick={(e) => { e.stopPropagation(); handleEditCatalog(catalog); }}
                         title={`Edit ${catalog.name}`}
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                         </svg>
                     </Button>
                     {/* Delete Button */}
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(catalog.id); }}
                        title={`Delete ${catalog.name}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                 </div>
              </SidebarMenuItem>
            ))}
             {catalogs && catalogs.length === 0 && !isLoadingCatalogs && (
                <p className="px-2 text-sm text-muted-foreground">No catalogs yet. Create one!</p>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if needed */}
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {showCatalogForm && (
            <div className="mb-6 max-w-2xl mx-auto">
             <div className="flex justify-end mb-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
              </div>
              <CatalogForm
                 onSubmit={editingCatalog ? handleUpdateCatalog : handleCreateCatalog}
                 initialData={editingCatalog ?? undefined}
                 isLoading={addCatalogMutation.isPending || updateCatalogMutation.isPending}
                 key={editingCatalog?.id || 'new'} // Re-render form when editing different catalog
              />
            </div>
          )}

          {selectedCatalogId && !showCatalogForm && (
             <CatalogItems catalogId={selectedCatalogId} />
          )}

          {!selectedCatalogId && !showCatalogForm && !isLoadingCatalogs && catalogs && catalogs.length > 0 && (
             <div className="flex flex-col items-center justify-center h-full text-center">
                <LayoutGrid className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold text-muted-foreground">Select a catalog</h2>
                <p className="text-muted-foreground">Choose a catalog from the sidebar to view its items, or create a new one.</p>
            </div>
          )}

           {!selectedCatalogId && !showCatalogForm && !isLoadingCatalogs && catalogs && catalogs.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-center">
                <PlusCircle className="w-16 h-16 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold text-muted-foreground">Welcome to Catalogify!</h2>
                <p className="text-muted-foreground">Get started by creating your first catalog using the button in the sidebar.</p>
            </div>
          )}


        </main>
      </SidebarInset>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the catalog
                and all its associated items.
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
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90" // Destructive variant styling
            >
                {deleteCatalogMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </SidebarProvider>
  );
}
