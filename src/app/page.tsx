
"use client";

import React, { useState, useEffect } from 'react';
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
import { PlusCircle, LayoutGrid, Trash2, AlertTriangle, Edit, Loader2, Plus, PackageSearch } from "lucide-react";
import { CatalogForm } from "@/components/catalog/catalog-form";
import type { Catalog } from "@/types";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc, updateDoc, getDocs, Timestamp, writeBatch, where, getDoc } from "firebase/firestore";
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


export default function Home() {
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [catalogToDelete, setCatalogToDelete] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: catalogs, isLoading: isLoadingCatalogs, error: catalogsError } = useQuery<Catalog[]>({
    queryKey: ['catalogs'],
    queryFn: async () => {
        const q = query(collection(db, "catalogs"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
             const data = doc.data();
             return {
                id: doc.id,
                name: data.name,
                description: data.description,
                createdAt: data.createdAt as Timestamp,
            } as Catalog;
        });
    },
  });

    const { data: catalogDetails, isLoading: isLoadingCatalogDetails } = useQuery<Catalog | null>({
        queryKey: ['catalog', selectedCatalogId],
        queryFn: async () => {
            if (!selectedCatalogId) return null;
            const docRef = doc(db, "catalogs", selectedCatalogId);
            const docSnap = await getDoc(docRef); // Changed from getDocs to getDoc
            if (docSnap.exists()) {
                 const data = docSnap.data() as Omit<Catalog, 'id'>;
                 return { id: docSnap.id, ...data } as Catalog;
            } else {
                return null;
            }
        },
        enabled: !!selectedCatalogId,
    });


  const addCatalogMutation = useMutation({
    mutationFn: async (newCatalogData: Pick<Catalog, 'name' | 'description'>): Promise<string> => {
        const docRef = await addDoc(collection(db, "catalogs"), {
            ...newCatalogData,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      toast({
        title: "Catalog Created",
        description: "Your new catalog has been added.",
      });
      setShowCatalogForm(false);
      setEditingCatalog(null);
      setSelectedCatalogId(newId); 
    },
    onError: (error) => {
      console.error("Error adding catalog: ", error);
      toast({
        title: "Error Creating Catalog",
        description: (error as Error)?.message || "Could not create catalog. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateCatalogMutation = useMutation({
      mutationFn: async ({ id, data }: { id: string, data: Partial<Pick<Catalog, 'name' | 'description'>> }) => {
          const catalogRef = doc(db, "catalogs", id);
          await updateDoc(catalogRef, data);
      },
      onSuccess: (_, variables) => {
          queryClient.invalidateQueries({ queryKey: ['catalogs'] });
          queryClient.invalidateQueries({ queryKey: ['catalog', variables.id] });
          toast({
              title: "Catalog Updated",
              description: "Your catalog has been saved.",
          });
          setEditingCatalog(null); 
          setShowCatalogForm(false); 
          setSelectedCatalogId(variables.id); 
      },
      onError: (error) => {
          console.error("Error updating catalog: ", error);
          toast({
              title: "Error Updating Catalog",
              description: (error as Error)?.message || "Could not update catalog.",
              variant: "destructive",
          });
      },
  });

  const deleteCatalogMutation = useMutation({
    mutationFn: async (catalogIdToDelete: string) => {
       const batch = writeBatch(db);
       const itemsQuery = query(collection(db, "items"), where("catalogId", "==", catalogIdToDelete));
       const itemsSnapshot = await getDocs(itemsQuery);
       itemsSnapshot.docs.forEach((itemDoc) => {
           batch.delete(doc(db, "items", itemDoc.id));
       });
       batch.delete(doc(db, "catalogs", catalogIdToDelete));
       await batch.commit();
       return catalogIdToDelete;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['catalogs'] });
      queryClient.removeQueries({ queryKey: ['items', deletedId] }); 
      queryClient.removeQueries({ queryKey: ['catalog', deletedId] });
      if (selectedCatalogId === deletedId) {
        setSelectedCatalogId(null);
      }
      toast({
        title: "Catalog Deleted",
        description: "The catalog and all its items have been removed.",
      });
      setCatalogToDelete(null); 
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      console.error("Error deleting catalog and its items: ", error);
       toast({
         title: "Error Deleting Catalog",
         description: (error as Error)?.message || "Could not delete catalog and its items.",
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
      setShowCatalogForm(false); 
      setEditingCatalog(null); 
  }

  const handleEditCatalog = (catalog: Catalog) => {
      setEditingCatalog(catalog);
      setSelectedCatalogId(null); 
      setShowCatalogForm(true); 
  }

  const handleOpenCreateForm = () => {
    setShowCatalogForm(true);
    setSelectedCatalogId(null);
    setEditingCatalog(null);
  }

  const handleCancelForm = () => {
       setEditingCatalog(null);
       setShowCatalogForm(false);
        if (catalogs && catalogs.length > 0) {
            const previouslySelectedId = queryClient.getQueryData<Catalog[]>(['catalogs'])?.find(c => c.id === selectedCatalogId)?.id;
            if (previouslySelectedId) {
                setSelectedCatalogId(previouslySelectedId);
            } else {
                 const wasViewingCatalog = !!queryClient.getQueryData<Catalog[]>(['catalogs'])?.find(c => c.id === selectedCatalogId);
                 if (wasViewingCatalog || (!selectedCatalogId && catalogs.length > 0)) { 
                    setSelectedCatalogId(catalogs[0].id);
                 }
            }
        }
   }

    useEffect(() => {
        if (!selectedCatalogId && !showCatalogForm && !isLoadingCatalogs && catalogs && catalogs.length > 0) {
            setSelectedCatalogId(catalogs[0].id);
        }
    }, [catalogs, isLoadingCatalogs, selectedCatalogId, showCatalogForm]);


  return (
    <SidebarProvider>
      <Sidebar collapsible="icon"> 
        <SidebarHeader className="items-center justify-between p-2">
          <h2 className="text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden">Catalogify</h2>
          <div className="flex items-center gap-1">
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <Button
            variant="default"
            className="w-full mb-4 hidden md:flex"
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
                        isActive={selectedCatalogId === catalog.id && !showCatalogForm && !editingCatalog}
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
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-20">
          <h1 className="text-lg font-semibold text-primary truncate">
            {isLoadingCatalogDetails && selectedCatalogId ? (
              <Skeleton className="h-6 w-32" />
            ) : selectedCatalogId && catalogDetails ? (
              catalogDetails.name
            ) : (
              "Catalogify"
            )}
          </h1>
          <SidebarTrigger />
        </div>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {showCatalogForm ? (
             <div className="mb-6 max-w-full md:max-w-2xl mx-auto relative">
             <Button variant="ghost" size="sm" onClick={handleCancelForm} className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground">Cancel</Button>
              <CatalogForm
                 onSubmit={editingCatalog ? handleUpdateCatalog : handleCreateCatalog}
                 initialData={editingCatalog ?? undefined}
                 isLoading={addCatalogMutation.isPending || updateCatalogMutation.isPending}
                 key={editingCatalog?.id || 'new-catalog-form'} 
              />
            </div>
          ) : selectedCatalogId ? (
             <CatalogItems catalogId={selectedCatalogId} />
          ) : (
            <>
              {isLoadingCatalogs && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Loader2 className="w-16 h-16 text-primary mb-4 animate-spin" />
                  <p className="text-muted-foreground">Loading catalogs...</p>
                </div>
              )}
              {!isLoadingCatalogs && catalogs && catalogs.length > 0 && !selectedCatalogId && (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                    <LayoutGrid className="w-12 h-12 md:w-16 md:h-16 text-primary mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">Select a catalog</h2>
                    <p className="text-muted-foreground text-sm md:text-base">Choose a catalog from the sidebar to view its items, or create a new one.</p>
                </div>
              )}
              {!isLoadingCatalogs && catalogs && catalogs.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-center">
                    <PackageSearch className="w-12 h-12 md:w-16 md:h-16 text-primary mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">Welcome to Catalogify!</h2>
                    <p className="text-muted-foreground text-sm md:text-base">Get started by creating your first catalog using the button in the sidebar or the + button below.</p>
                     <Button onClick={handleOpenCreateForm} className="mt-6 hidden md:inline-flex">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Catalog
                    </Button>
                </div>
              )}
               {!isLoadingCatalogs && catalogsError && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-destructive">
                    <AlertTriangle className="w-12 h-12 md:w-16 md:h-16 mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold">Error Loading Catalogs</h2>
                    <p className="text-sm md:text-base">Could not fetch your catalogs. Please check your connection and try again.</p>
                     <Button onClick={() => queryClient.refetchQueries({ queryKey: ['catalogs'] })} variant="outline" className="mt-4">
                        Try Again
                    </Button>
                </div>
              )}
            </>
          )}
        </main>

        <Fab
            className="md:hidden fixed bottom-4 right-4 z-30 shadow-lg"
            onClick={handleOpenCreateForm}
            aria-label="Create New Catalog"
        >
            <Plus className="h-6 w-6" />
        </Fab>

      </SidebarInset>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the catalog and <span className="font-semibold">all items within it.</span>
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setCatalogToDelete(null); setShowDeleteDialog(false);}}>Cancel</AlertDialogCancel>
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
                {deleteCatalogMutation.isPending ? "Deleting..." : "Delete Catalog"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </SidebarProvider>
  );
}

    