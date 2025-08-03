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
import { PlusCircle, LayoutGrid, Trash2, AlertTriangle, Edit, Loader2, Plus, PackageSearch, Home as HomeIcon, Boxes, Library, Eye, Users, ClipboardList } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CatalogItems } from '@/components/catalog/catalog-items';
import { Skeleton } from '@/components/ui/skeleton';
import { FabMenu } from '@/components/ui/fab';
import Link from 'next/link';
import { CartSheet } from '@/components/cart/cart-sheet';


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
        title: "Catálogo Creado",
        description: "Tu nuevo catálogo ha sido añadido.",
      });
      setShowCatalogForm(false);
      setEditingCatalog(null);
      setSelectedCatalogId(newId);
    },
    onError: (error) => {
      console.error("Error al añadir catálogo: ", error);
      toast({
        title: "Error al Crear Catálogo",
        description: (error as Error)?.message || "No se pudo crear el catálogo. Por favor, inténtalo de nuevo.",
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
              title: "Catálogo Actualizado",
              description: "Tu catálogo ha sido guardado.",
          });
          setEditingCatalog(null); 
          setShowCatalogForm(false); 
          setSelectedCatalogId(variables.id);
      },
      onError: (error) => {
          console.error("Error al actualizar catálogo: ", error);
          toast({
              title: "Error al Actualizar Catálogo",
              description: (error as Error)?.message || "No se pudo actualizar el catálogo.",
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
        title: "Catálogo Eliminado",
        description: "El catálogo y todos sus productos han sido eliminados.",
      });
      setCatalogToDelete(null); 
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      console.error("Error al eliminar catálogo y sus productos: ", error);
       toast({
         title: "Error al Eliminar Catálogo",
         description: (error as Error)?.message || "No se pudo eliminar el catálogo y sus productos.",
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
       if (!selectedCatalogId) {
         setSelectedCatalogId(null); // Go back to dashboard if no catalog was selected
       }
   }
   
   const handleBackToDashboard = () => {
       setSelectedCatalogId(null);
       setShowCatalogForm(false);
       setEditingCatalog(null);
   }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon"> 
        <SidebarHeader className="items-center justify-between p-2">
          <Link href="/" onClick={handleBackToDashboard} className="text-lg font-semibold text-sidebar-primary group-data-[collapsible=icon]:hidden">
            Catalogify
          </Link>
          <div className="flex items-center gap-1">
             <CartSheet />
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <Button
            variant="default"
            className="w-full mb-4 hidden md:flex"
            onClick={handleOpenCreateForm}
            title="Crear Nuevo Catálogo"
          >
            <PlusCircle className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
             <span className="group-data-[collapsible=icon]:hidden">Crear Catálogo</span>
          </Button>
          <SidebarMenu>
             <SidebarMenuItem>
                 <SidebarMenuButton
                     isActive={!selectedCatalogId && !showCatalogForm}
                     onClick={handleBackToDashboard}
                     tooltip={{ children: "Dashboard", side: 'right', align: 'center' }}
                     className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap"
                 >
                    <Library />
                    <span>Dashboard</span>
                 </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                 <SidebarMenuButton
                     asChild
                     tooltip={{ children: "Pedidos", side: 'right', align: 'center' }}
                     className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap"
                 >
                    <Link href="/orders">
                      <ClipboardList />
                      <span>Pedidos</span>
                    </Link>
                 </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                 <SidebarMenuButton
                     asChild
                     tooltip={{ children: "Clientes", side: 'right', align: 'center' }}
                     className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap"
                 >
                    <Link href="/customers">
                      <Users />
                      <span>Clientes</span>
                    </Link>
                 </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                 <SidebarMenuButton
                     asChild
                     tooltip={{ children: "Ver Tienda", side: 'right', align: 'center' }}
                     className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap"
                 >
                    <Link href="/items">
                      <Boxes />
                      <span>Ver Tienda</span>
                    </Link>
                 </SidebarMenuButton>
            </SidebarMenuItem>
            
            {isLoadingCatalogs && (
               <>
                 <SidebarMenuSkeleton showIcon />
                 <SidebarMenuSkeleton showIcon />
                 <SidebarMenuSkeleton showIcon />
               </>
            )}
            {catalogsError && (
              <SidebarMenuItem className="text-destructive px-2 py-1 text-xs">
                <AlertTriangle className="inline-block mr-2 h-4 w-4"/> Error al cargar.
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
                            title={`Editar ${catalog.name}`}
                        >
                           <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive/90"
                            onClick={(e) => { e.stopPropagation(); openDeleteDialog(catalog.id); }}
                            title={`Eliminar ${catalog.name}`}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                 </div>
              </SidebarMenuItem>
            ))}
             {catalogs && catalogs.length === 0 && !isLoadingCatalogs && !showCatalogForm && (
                <p className="px-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">Aún no hay catálogos. ¡Crea uno!</p>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-20">
          <h1 className="text-lg font-semibold text-primary truncate">
            { selectedCatalogId ? (catalogs?.find(c => c.id === selectedCatalogId)?.name || "Catálogo") : "Dashboard"}
          </h1>
           <div className="flex items-center gap-2">
            <CartSheet />
            <SidebarTrigger />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {showCatalogForm ? (
             <div className="mb-6 max-w-full md:max-w-2xl mx-auto relative">
             <Button variant="ghost" size="sm" onClick={handleCancelForm} className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground">Cancelar</Button>
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
            // DASHBOARD VIEW
            <>
              <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">Dashboard de Catálogos</h1>
                <p className="text-muted-foreground mt-1">Gestiona tus catálogos o crea uno nuevo.</p>
              </div>

              {isLoadingCatalogs && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-6 w-3/4 mb-2" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </CardHeader>
                            <CardFooter>
                                <Skeleton className="h-10 w-24" />
                                <Skeleton className="h-10 w-24" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
              )}

              {catalogsError && (
                 <div className="flex flex-col items-center justify-center h-full text-center text-destructive py-10">
                    <AlertTriangle className="w-12 h-12 md:w-16 md:h-16 mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold">Error al Cargar Catálogos</h2>
                    <p className="text-sm md:text-base">No se pudieron obtener tus catálogos. Por favor, revisa tu conexión e inténtalo de nuevo.</p>
                     <Button onClick={() => queryClient.refetchQueries({ queryKey: ['catalogs'] })} variant="outline" className="mt-4">
                        Intentar de Nuevo
                    </Button>
                </div>
              )}
              
              {!isLoadingCatalogs && !catalogsError && catalogs && catalogs.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-center py-10 border-2 border-dashed rounded-lg">
                    <PackageSearch className="w-12 h-12 md:w-16 md:h-16 text-primary mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold text-foreground">¡Bienvenido a Catalogify!</h2>
                    <p className="text-muted-foreground text-sm md:text-base">Comienza creando tu primer catálogo para añadir productos.</p>
                     <Button onClick={handleOpenCreateForm} className="mt-6">
                        <PlusCircle className="mr-2 h-4 w-4" /> Crea tu Primer Catálogo
                    </Button>
                </div>
              )}

              {!isLoadingCatalogs && !catalogsError && catalogs && catalogs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {catalogs.map(catalog => (
                        <Card key={catalog.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="text-xl line-clamp-2">{catalog.name}</CardTitle>
                                <CardDescription className="line-clamp-3 h-[60px]">{catalog.description || 'Sin descripción.'}</CardDescription>
                            </CardHeader>
                            <CardFooter className="mt-auto flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditCatalog(catalog)}>
                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                </Button>
                                <Button size="sm" onClick={() => handleSelectCatalog(catalog.id)}>
                                    <Eye className="mr-2 h-4 w-4" /> Ver
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
              )}
            </>
          )}
        </main>

        <FabMenu
          actions={[
            {
              label: 'Dashboard',
              icon: <HomeIcon className="h-6 w-6" />,
              onClick: handleBackToDashboard,
            },
            {
              label: 'Ver Tienda',
              icon: <Boxes className="h-6 w-6" />,
              href: '/items',
            },
            {
              label: 'Crear Catálogo',
              icon: <Plus className="h-6 w-6" />,
              onClick: handleOpenCreateForm,
            },
          ]}
        />


      </SidebarInset>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
                Esta acción no se puede deshacer. Esto eliminará permanentemente el catálogo y <span className="font-semibold">todos los productos que contiene.</span>
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setCatalogToDelete(null); setShowDeleteDialog(false);}}>Cancelar</AlertDialogCancel>
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
                {deleteCatalogMutation.isPending ? "Eliminando..." : "Eliminar Catálogo"}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    </SidebarProvider>
  );
}
