
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc, getDoc, Timestamp, writeBatch } from "firebase/firestore"; // Import Timestamp and writeBatch
import { db } from "@/lib/firebase";
import type { Catalog, Item } from "@/types";
import { ItemForm, type ItemFormValues } from '@/components/item/item-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash2, Edit, AlertTriangle, ImageOff, Loader2, Search, Star, Share2, Upload, Download, MoreVertical, FileText, Camera, Eye, EyeOff } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { ItemDetailModal } from '@/components/item/item-detail-modal';


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
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogContainerRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemWithTimestamp | null>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch items for the selected catalog
  const { data: itemsWithTimestamp, isLoading: isLoadingItems, error: itemsError } = useQuery<ItemWithTimestamp[] | undefined>({
    queryKey: ['items', catalogId], // Include catalogId in the query key
    queryFn: async () => {
      if (!catalogId) {
        return undefined;
      }
      // No 'isVisible' filter here to show all items to admin
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
               price: data.price,
               imageUrl: data.imageUrl,
               tags: data.tags,
               createdAt: data.createdAt as Timestamp,
               catalogId: data.catalogId,
               isFeatured: data.isFeatured,
               isVisible: data.isVisible,
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
      (item.description && item.description.toLowerCase().includes(query)) ||
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
            price: data.price,
            imageUrl: data.imageUrl,
            tags: Array.isArray(data.tags) ? data.tags : [],
            catalogId: currentCatalogId,
            isFeatured: data.isFeatured,
            isVisible: data.isVisible,
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
        mutationFn: async ({ id, data }: { id: string, data: Partial<ItemFormValues> }) => { 
            const itemRef = doc(db, "items", id);
            await updateDoc(itemRef, data);
        },
        onSuccess: (_, variables) => { 
            queryClient.invalidateQueries({ queryKey: ['items', catalogId] });
            toast({
                title: variables.data.isVisible === undefined ? "Producto Actualizado" : "Visibilidad Actualizada",
                description: variables.data.isVisible === undefined ? "El producto ha sido guardado." : `El producto ahora es ${variables.data.isVisible ? 'visible' : 'oculto'}.`,
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const requiredHeaders = ['name', 'price', 'description', 'imageUrl', 'tags', 'isFeatured', 'isVisible'];
        const actualHeaders = results.meta.fields || [];
        const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));

        if (missingHeaders.length > 0) {
          toast({
            title: 'Error en el Archivo CSV',
            description: `Faltan las siguientes columnas: ${missingHeaders.join(', ')}`,
            variant: 'destructive',
          });
          setIsImporting(false);
          return;
        }

        const itemsToAdd = results.data as any[];

        try {
          const batch = writeBatch(db);
          itemsToAdd.forEach(item => {
            const itemRef = doc(collection(db, "items"));
            const tagsArray = typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()) : [];
            const isFeaturedBool = item.isFeatured?.toLowerCase() === 'true';
            const isVisibleBool = item.isVisible?.toLowerCase() !== 'false'; // Default to true unless explicitly 'false'
            const priceNumber = parseFloat(item.price);

            batch.set(itemRef, {
              name: item.name || '',
              description: item.description || '',
              price: isNaN(priceNumber) ? 0 : priceNumber,
              imageUrl: item.imageUrl || '',
              tags: tagsArray,
              isFeatured: isFeaturedBool,
              isVisible: isVisibleBool,
              catalogId: catalogId,
              createdAt: serverTimestamp(),
            });
          });

          await batch.commit();
          queryClient.invalidateQueries({ queryKey: ['items', catalogId] });
          toast({
            title: 'Importación Exitosa',
            description: `${itemsToAdd.length} productos han sido añadidos al catálogo.`,
          });
        } catch (error) {
          toast({
            title: 'Error en la Importación',
            description: 'No se pudieron guardar los productos. Revisa la consola.',
            variant: 'destructive',
          });
          console.error("Error al importar CSV:", error);
        } finally {
          setIsImporting(false);
        }
      },
      error: (error) => {
        toast({
          title: 'Error al Leer el Archivo',
          description: error.message,
          variant: 'destructive',
        });
        setIsImporting(false);
      },
    });

    // Reset file input value to allow re-uploading the same file
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleExportCSV = () => {
    if (!itemsWithTimestamp || itemsWithTimestamp.length === 0) {
      toast({
        title: 'No hay productos para exportar',
        description: 'Añade productos al catálogo antes de exportar.',
        variant: 'destructive',
      });
      return;
    }

    const dataToExport = itemsWithTimestamp.map(item => ({
      name: item.name,
      price: item.price ?? 0,
      description: item.description,
      imageUrl: item.imageUrl || '',
      tags: Array.isArray(item.tags) ? item.tags.join(',') : '',
      isFeatured: item.isFeatured || false,
      isVisible: item.isVisible === false ? false : true,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const catalogName = catalogDetails?.name.replace(/ /g, '_') || 'catalogo';
    link.setAttribute('download', `${catalogName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
    const handleExportPDF = () => {
        if (!itemsWithTimestamp || !catalogDetails) {
            toast({
                title: 'No hay datos para exportar',
                description: 'El catálogo o los productos no están disponibles.',
                variant: 'destructive',
            });
            return;
        }

        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.text(catalogDetails.name, 105, 20, { align: 'center' });
        
        if (catalogDetails.description) {
            doc.setFontSize(12);
            // Use splitTextToSize to handle wrapping for long descriptions
            const descriptionLines = doc.splitTextToSize(catalogDetails.description, 180);
            doc.text(descriptionLines, 14, 30);
        }

        const tableColumn = ["Producto", "Descripción", "Precio"];
        const tableRows = itemsWithTimestamp.map(item => [
            item.name,
            item.description,
            `$${(item.price ?? 0).toFixed(2)}`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: catalogDetails.description ? 50 : 30, // Adjust startY based on description
            headStyles: { fillColor: [59, 130, 246] }, // A nice blue color
            styles: { halign: 'center' },
            columnStyles: { 
                0: { halign: 'left' },
                1: { halign: 'left' },
                2: { halign: 'right' }
            }
        });

        const catalogName = catalogDetails.name.replace(/ /g, '_') || 'catalogo';
        doc.save(`${catalogName}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleCaptureAndDownload = async () => {
        if (!catalogContainerRef.current) {
            toast({
                title: 'Error de Captura',
                description: 'No se pudo encontrar el contenido del catálogo para capturar.',
                variant: 'destructive',
            });
            return;
        }

        setIsCapturing(true);
        toast({
            title: 'Capturando Catálogo...',
            description: 'Esto puede tardar unos segundos.',
        });

        try {
            const canvas = await html2canvas(catalogContainerRef.current, {
                allowTaint: true,
                useCORS: true,
                scale: 2, // Increase resolution for better quality
                backgroundColor: '#ffffff', // Set a background color for transparency
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height],
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            const catalogName = catalogDetails?.name.replace(/ /g, '_') || 'catalogo';
            pdf.save(`${catalogName}_captura_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error("Error al capturar PDF:", error);
            toast({
                title: 'Error al Generar PDF',
                description: 'No se pudo crear la captura del catálogo.',
                variant: 'destructive',
            });
        } finally {
            setIsCapturing(false);
        }
    };


   const handleAddItem = async (data: ItemFormValues) => {
        await addItemMutation.mutateAsync({ data, catalogId });
    };

   const handleUpdateItem = async (data: ItemFormValues) => {
        if (editingItem?.id) {
            await updateItemMutation.mutateAsync({ id: editingItem.id, data });
        }
    };
    
    const handleToggleVisibility = (item: ItemWithTimestamp) => {
      const newVisibility = !(item.isVisible === false ? false : true);
      updateItemMutation.mutate({ id: item.id, data: { isVisible: newVisibility } });
    }

    const handleEditItem = (item: ItemWithTimestamp) => {
        setEditingItem(item);
        setShowItemForm(true);
    }

    const openDeleteDialog = (id: string) => {
        setItemToDelete(id);
        setShowDeleteDialog(true);
    };

    const handleShareCatalog = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/catalog/${catalogId}`;
        try {
          await navigator.clipboard.writeText(url);
          toast({
            title: "Enlace Copiado",
            description: "El enlace público a este catálogo se ha copiado al portapapeles.",
          });
        } catch (err) {
          toast({
            title: "Error",
            description: "No se pudo copiar el enlace.",
            variant: "destructive",
          });
        }
      };
    

    const handleCancelForm = () => {
        setShowItemForm(false);
        setEditingItem(null);
    }


  return (
    <>
    <div ref={catalogContainerRef}>
       <div className="relative overflow-hidden h-auto md:h-64 w-full flex items-center justify-center">
        <div className="absolute inset-0">
          {isLoadingCatalogDetails ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <img
              src={catalogDetails?.imageUrl || 'https://placehold.co/1200x400.png'}
              alt={catalogDetails?.name || ''}
              className="w-full h-full object-cover"
              style={{ transform: `translateY(${scrollY * 0.4}px)` }}
              data-ai-hint="background image"
            />
          )}
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 w-full text-white text-center p-4">
            {isLoadingCatalogDetails ? (
                 <>
                    <Skeleton className="h-10 w-3/4 mb-2 mx-auto" />
                    <Skeleton className="h-5 w-1/2 mx-auto" />
                 </>
             ) : (
                <>
                    <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-white shadow-lg [text-shadow:0_2px_4px_var(--tw-shadow-color)]">
                        {catalogDetails?.name || "Productos del Catálogo"}
                    </h1>
                    {catalogDetails?.description && (
                        <p className="mt-2 text-xs sm:text-sm md:text-lg text-white/90 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">
                            {catalogDetails.description}
                        </p>
                    )}
                </>
             )}
            <div className="mt-4 flex flex-nowrap justify-center items-center gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    className="hidden" 
                    accept=".csv"
                />
                <Button size="sm" onClick={() => { setEditingItem(null); setShowItemForm(true); }} className="flex-shrink-0 bg-primary hover:bg-primary/90 text-xs sm:text-sm p-2 sm:px-3">
                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Añadir Producto
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className={cn("bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs sm:text-sm p-2 sm:px-3", "flex-shrink-0")}>
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Más opciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleShareCatalog}>
                      <Share2 className="mr-2 h-4 w-4" />
                      <span>Compartir Link</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                       {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                       <span>{isImporting ? 'Importando...' : 'Importar CSV'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportCSV} disabled={isLoadingItems || !itemsWithTimestamp || itemsWithTimestamp.length === 0}>
                      <Upload className="mr-2 h-4 w-4" />
                      <span>Exportar a CSV</span>
                    </DropdownMenuItem>
                     <DropdownMenuItem onClick={handleExportPDF} disabled={isLoadingItems || !itemsWithTimestamp || itemsWithTimestamp.length === 0}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Descargar PDF</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCaptureAndDownload} disabled={isCapturing}>
                        {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                        <span>{isCapturing ? 'Capturando...' : 'Capturar y Descargar'}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
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
              price: editingItem.price ?? 0,
              createdAt: editingItem.createdAt ? new Date(editingItem.createdAt.seconds * 1000 + (editingItem.createdAt.nanoseconds || 0) / 1000000) : undefined,
            } as Partial<Item> : {}} 
            isLoading={addItemMutation.isPending || updateItemMutation.isPending}
            key={editingItem?.id || 'new-item'}
          />
        </DialogContent>
      </Dialog>
      {!isLoadingItems && featuredItems && featuredItems.length > 0 && (
        <div className='space-y-4 p-4 md:p-6'>
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
                        {featuredItems.map((item, index) => {
                            const isVisible = item.isVisible === false ? false : true;
                            return (
                            <CarouselItem key={item.id} className="md:basis-1/2 lg:basis-1/3 pl-4">
                                <div className="p-1 h-full">
                                    <Card className={cn(
                                        "group relative w-full h-full aspect-video overflow-hidden rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl",
                                        !isVisible && "opacity-50"
                                    )}>
                                        <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="outline" size="icon" className="h-8 w-8 bg-background/70 hover:bg-background" onClick={(e) => { e.stopPropagation(); handleToggleVisibility(item); }} title={isVisible ? "Ocultar producto" : "Mostrar producto"}>
                                                {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="outline" size="icon" className="h-8 w-8 bg-background/70 hover:bg-background" onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}>
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Edit Item</span>
                                            </Button>
                                            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item.id); }}>
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Delete Item</span>
                                            </Button>
                                        </div>
                                        {!isVisible && (
                                          <div className="absolute top-2 left-2 z-10">
                                            <Badge variant="secondary" className="bg-background/70">
                                              <EyeOff className="mr-1.5 h-3 w-3"/> Oculto
                                            </Badge>
                                          </div>
                                        )}
                                        {item.imageUrl ? (
                                            <img
                                                src={item.imageUrl}
                                                alt={item.name || 'Imagen del producto'}
                                                className="object-cover w-full h-full transition-transform duration-500 ease-in-out group-hover:scale-105"
                                                data-ai-hint="product photo"
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
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 flex flex-col justify-end" onClick={() => setSelectedItem(item)}>
                                            <CardTitle className="text-2xl font-bold text-white shadow-black [text-shadow:0_2px_4px_var(--tw-shadow-color)] line-clamp-2">{item.name}</CardTitle>
                                            <p className="text-lg font-semibold text-white mt-1 [text-shadow:0_1px_2px_var(--tw-shadow-color)]">${(item.price ?? 0).toFixed(2)}</p>
                                        </div>
                                    </Card>
                                </div>
                            </CarouselItem>
                        )})}
                    </CarouselContent>
                    <CarouselPrevious className="hidden sm:flex" />
                    <CarouselNext className="hidden sm:flex" />
                </Carousel>
            </div>
            <Separator className="my-6" />
        </div>
      )}
      
      <div className="p-4 md:p-6 space-y-4">
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
                      <CardHeader className="p-0">
                          <Skeleton className="aspect-video w-full" data-ai-hint="placeholder image" />
                      </CardHeader>
                      <CardContent className="flex-grow p-4">
                          <Skeleton className="h-6 w-3/4 mb-2" />
                          <Skeleton className="h-5 w-1/2" />
                      </CardContent>
                       <CardFooter className="flex justify-end gap-2 p-3">
                           <Skeleton className="h-9 w-20" />
                           <Skeleton className="h-9 w-20" />
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
        {!isLoadingItems && !itemsError && filteredRegularItems.length === 0 && (searchQuery || (regularItems && regularItems.length > 0)) && (
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
            {filteredRegularItems.map((item, index) => {
              const isVisible = item.isVisible === false ? false : true;
              return (
              <Card 
                key={item.id} 
                className={cn(
                  "group flex flex-col overflow-hidden rounded-lg border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer",
                  !isVisible && "opacity-60 hover:opacity-100"
                )}
                onClick={() => setSelectedItem(item)}
              >
                 <CardHeader className="p-0">
                  <div className="aspect-video relative bg-muted overflow-hidden">
                       {!isVisible && (
                          <Badge variant="secondary" className="absolute top-2 left-2 z-10 bg-black/60 text-white border-none">
                            <EyeOff className="mr-1.5 h-3 w-3"/> Oculto
                          </Badge>
                       )}
                       {item.imageUrl ? (
                          <img
                             src={item.imageUrl}
                             alt={item.name || 'Imagen del producto'}
                             className="transition-transform duration-300 group-hover:scale-105 w-full h-full object-cover"
                             data-ai-hint="product photo"
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
                   </div>
                </CardHeader>
                <CardContent className="flex-grow p-4 flex flex-col">
                   <CardTitle className="text-lg mb-1 line-clamp-2 font-semibold flex-grow">{item.name}</CardTitle>
                   <p className="text-md font-bold text-primary mt-2">${(item.price ?? 0).toFixed(2)}</p>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 p-3 border-t bg-background/50 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleVisibility(item);}} className="flex-1" title={isVisible ? "Ocultar producto" : "Mostrar producto"}>
                      {isVisible ? <Eye className="mr-1.5 h-3.5 w-3.5" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
                      {isVisible ? 'Ocultar' : 'Mostrar'}
                   </Button>
                   <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEditItem(item);}} className="flex-1">
                    <Edit className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item.id);}} className="flex-1">
                     <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
                  </Button>
                </CardFooter>
              </Card>
            )})}
          </div>
  )}
      </div>
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
    <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </>
  );
}
