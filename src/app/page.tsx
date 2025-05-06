
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
import { PlusCircle, LayoutGrid, Trash2, AlertTriangle, Edit, Loader2 } from "lucide-react"; // Added Edit and Loader2
import { CatalogForm } from "@/components/catalog/catalog-form";
import type { Catalog } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc, getDocs } from "firebase/firestore"; // Added getDocs
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
import { Skeleton } from '@/components/ui/skeleton'; // Added Skeleton

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
        // Removed unnecessary import inside queryFn
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
      mutationFn: async ({ id, data }: { id: string, data: Partial<Omit<Catalog, 'id' | 'createdAt'>> }) => { // Ensure data type matches form
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
       // TODO: Also delete all items within this catalog (requires fetching items first or using Cloud Functions)
       // Consider implementing cascading deletes via Cloud Functions for robustness
      await deleteDoc(doc(db, "catalogs", catalogId));
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      queryClient.removeQueries({ queryKey: ['items', deletedId] }); // Remove items query cache
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

  const handleCancelForm = () => {
       setEditingCatalog(null);
       setShowCatalogForm(false);
        // If a catalog was selected before opening the form, reselect it
        // This logic might need adjustment based on desired UX
        // if (previousSelectedCatalogId) {
        //     setSelectedCatalogId(previousSelectedCatalogId);
        // }
   }


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="items-center justify-between p-2"> {/* Adjusted padding */}
          <h2 className="text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden">Catalogify</h2>
          {/* Ensure trigger is always visible */}
          <div className="flex items-center gap-1">
             {/* Add a placeholder or adjust layout if needed when collapsed */}
             {/* <span className="w-8 h-8 group-data-[collapsible=icon]:block hidden"></span> */}
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <Button
            variant="default" // Use primary color
            className="w-full mb-4"
            onClick={() => { setShowCatalogForm(true); setSelectedCatalogId(null); setEditingCatalog(null); }}
            title="Create New Catalog" // Add title for collapsed state
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
              <SidebarMenuItem className="text-destructive px-2 py-1 text-xs"> {/* Adjusted styling */}
                <AlertTriangle className="inline-block mr-2 h-4 w-4"/> Error loading.
              </SidebarMenuItem>
            )}
            {catalogs && catalogs.map((catalog) => (
              <SidebarMenuItem key={catalog.id}>
                 <div className="relative group/menu-item flex items-center"> {/* Wrap button and actions */}
                    <SidebarMenuButton
                        isActive={selectedCatalogId === catalog.id}
                        onClick={() => handleSelectCatalog(catalog.id)}
                        tooltip={{ children: catalog.name, side: 'right', align: 'center' }}
                        className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap pr-12" // Added padding-right for actions
                    >
                        <LayoutGrid />
                        <span>{catalog.name}</span>
                    </SidebarMenuButton>
                    {/* Actions always visible for clarity, adjusted position */}
                     <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex gap-0.5 opacity-0 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100 transition-opacity group-data-[collapsible=icon]:hidden">
                        {/* Edit Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground" // Adjusted styling
                            onClick={(e) => { e.stopPropagation(); handleEditCatalog(catalog); }}
                            title={`Edit ${catalog.name}`}
                        >
                           <Edit className="h-4 w-4" />
                        </Button>
                        {/* Delete Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive/90" // Adjusted styling
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
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto"> {/* Ensure main content is scrollable */}
          {/* Show form or items based on state */}
          {showCatalogForm ? (
             <div className="mb-6 max-w-full md:max-w-2xl mx-auto relative"> {/* Responsive max-width */}
             <Button variant="ghost" size="sm" onClick={handleCancelForm} className="absolute top-4 right-4 z-10">Cancel</Button>
              <CatalogForm
                 onSubmit={editingCatalog ? handleUpdateCatalog : handleCreateCatalog}
                 initialData={editingCatalog ?? undefined}
                 isLoading={addCatalogMutation.isPending || updateCatalogMutation.isPending}
                 key={editingCatalog?.id || 'new'} // Re-render form when editing different catalog
              />
            </div>
          ) : selectedCatalogId ? (
             <CatalogItems catalogId={selectedCatalogId} />
          ) : (
            // Welcome / Placeholder messages
            <>
              {isLoadingCatalogs && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Loader2 className="w-16 h-16 text-muted-foreground mb-4 animate-spin" />
                  <p className="text-muted-foreground">Loading catalogs...</p>
                </div>
              )}
              {!isLoadingCatalogs && catalogs && catalogs.length > 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                    <LayoutGrid className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mb-4" /> {/* Responsive icon size */}
                    <h2 className="text-lg md:text-xl font-semibold text-muted-foreground">Select a catalog</h2>
                    <p className="text-muted-foreground text-sm md:text-base">Choose a catalog from the sidebar to view its items, or create a new one.</p>
                </div>
              )}
              {!isLoadingCatalogs && catalogs && catalogs.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                    <PlusCircle className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground mb-4" /> {/* Responsive icon size */}
                    <h2 className="text-lg md:text-xl font-semibold text-muted-foreground">Welcome to Catalogify!</h2>
                    <p className="text-muted-foreground text-sm md:text-base">Get started by creating your first catalog using the button in the sidebar.</p>
                </div>
              )}
               {!isLoadingCatalogs && catalogsError && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-destructive">
                    <AlertTriangle className="w-12 h-12 md:w-16 md:h-16 mb-4" /> {/* Responsive icon size */}
                    <h2 className="text-lg md:text-xl font-semibold">Error Loading Catalogs</h2>
                    <p className="text-sm md:text-base">Could not fetch your catalogs. Please check your connection and try again.</p>
                </div>
              )}
            </>
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
