
"use client";

import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as CardDesc } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, DollarSign, Upload, Clipboard, Info, Sparkles, Wand2 } from "lucide-react"; 
import type { Item } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFirebaseStorage } from "@/hooks/use-firebase-storage";
import { Progress } from "../ui/progress";
import { suggestTags } from "@/ai/flows/suggest-tags";
import { generateProductImage } from "@/ai/flows/generate-product-image";


const itemFormSchema = z.object({
  name: z.string().min(1, "El nombre del producto es obligatorio").max(100, "Nombre demasiado largo (máx. 100 caracteres)"),
  description: z.string().max(1000, "Descripción demasiado larga (máx. 1000 caracteres)").optional(),
  price: z.coerce.number().min(0, "El precio debe ser un número positivo.").refine(val => val !== null && val !== undefined, { message: "El precio es obligatorio" }),
  imageUrl: z.string().url("Formato de URL inválido. Por favor, introduce una URL válida https:// o http://.").optional().or(z.literal("")),
  tags: z.array(z.string().min(1, "La etiqueta no puede estar vacía.").max(50, "Etiqueta demasiado larga (máx. 50 caracteres).")).max(10, "Máximo 10 etiquetas permitidas."),
  isFeatured: z.boolean().default(false),
  isVisible: z.boolean().default(true),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

interface ItemFormProps {
  initialData?: Partial<Item>;
  onFormSubmit: (data: ItemFormValues) => void;
  isLoading?: boolean;
}

export function ItemForm({ initialData, onFormSubmit, isLoading = false }: ItemFormProps) {
  const { toast } = useToast();
  
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price || 0,
      imageUrl: initialData?.imageUrl || "",
      tags: initialData?.tags || [],
      isFeatured: initialData?.isFeatured || false,
      isVisible: initialData?.isVisible === false ? false : true, 
    },
  });

  const { uploadFile, uploadProgress, isUploading, fileUrl, error } = useFirebaseStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTag, setCurrentTag] = useState("");
  const tags = form.watch("tags");
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  useEffect(() => {
    if (fileUrl) {
      form.setValue("imageUrl", fileUrl, { shouldValidate: true });
    }
  }, [fileUrl, form]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error al Subir Imagen",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFile(file, 'item-images');
    }
     if (event.target) {
        event.target.value = '';
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        toast({
          title: "Función no Soportada",
          description: "Tu navegador no permite pegar desde el portapapeles de forma segura.",
          variant: "destructive",
        });
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        form.setValue("imageUrl", text, { shouldValidate: true });
        toast({
          title: "Enlace Pegado",
          description: "Se ha pegado la URL desde tu portapapeles.",
        });
      } else {
         toast({
          title: "Enlace no válido",
          description: "El texto copiado no parece ser una URL válida.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al pegar desde el portapapeles:", error);
      toast({
        title: "Error al Pegar",
        description: "No se pudo leer el portapapeles. Asegúrate de haber concedido permisos.",
        variant: "destructive",
      });
    }
  };

  const handleAddTag = (tagToAdd: string) => {
    const newTag = tagToAdd.trim().toLowerCase(); 
    if (newTag && !tags.map(t => t.toLowerCase()).includes(newTag) && tags.length < 10) {
      form.setValue("tags", [...tags, newTag], { shouldValidate: true });
    }
    setCurrentTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    form.setValue(
      "tags",
      tags.filter((tag) => tag.toLowerCase() !== tagToRemove.toLowerCase()),
      { shouldValidate: true }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (currentTag.trim()) { 
        handleAddTag(currentTag);
      }
    }
  };
  
  const handleSuggestTags = async () => {
    const description = form.getValues("description");
    if (!description || description.trim().length < 10) {
        toast({
            title: "Descripción Insuficiente",
            description: "Por favor, escribe una descripción de al menos 10 caracteres para sugerir etiquetas.",
            variant: "destructive",
        });
        return;
    }
    setIsSuggestingTags(true);
    try {
        const result = await suggestTags({ itemDescription: description });
        if (result.tags && result.tags.length > 0) {
            // Add new tags, avoiding duplicates, and respecting the 10 tags limit
            const currentTags = form.getValues("tags").map(t => t.toLowerCase());
            const newTags = result.tags.filter(tag => !currentTags.includes(tag.toLowerCase()));
            const combinedTags = [...form.getValues("tags"), ...newTags].slice(0, 10);
            form.setValue("tags", combinedTags, { shouldValidate: true });
            toast({
                title: "Etiquetas Sugeridas",
                description: `${newTags.length} nuevas etiquetas fueron añadidas.`,
            });
        } else {
             toast({
                title: "No se encontraron nuevas etiquetas",
                description: "La IA no encontró sugerencias relevantes o ya existen.",
            });
        }
    } catch (error) {
        console.error("Error al sugerir etiquetas:", error);
        toast({
            title: "Error de la IA",
            description: `No se pudieron obtener las etiquetas: ${(error as Error).message}`,
            variant: "destructive",
        });
    } finally {
        setIsSuggestingTags(false);
    }
  };

  const handleGenerateImage = async () => {
    const name = form.getValues("name");
    const description = form.getValues("description");

    if (!name || name.trim().length < 3) {
      toast({
        title: "Nombre del Producto Requerido",
        description: "Por favor, introduce un nombre para el producto antes de generar una imagen.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGeneratingImage(true);
    toast({
        title: "Generando imagen...",
        description: "La IA está creando tu imagen. Esto puede tardar unos segundos.",
    });

    try {
        const result = await generateProductImage({ name, description: description || "" });
        if(result.wasGenerated) {
            form.setValue("imageUrl", result.imageUrl, { shouldValidate: true });
            toast({
                title: "Imagen Generada con Éxito",
                description: "La imagen creada por la IA ha sido añadida.",
            });
        } else {
            toast({
                title: "Fallo en la Generación",
                description: "No se pudo generar la imagen. Se usará una de reemplazo.",
                variant: "destructive",
            });
        }
    } catch (error) {
        console.error("Error al generar la imagen:", error);
        toast({
            title: "Error de la IA",
            description: `No se pudo generar la imagen: ${(error as Error).message}`,
            variant: "destructive",
        });
    } finally {
        setIsGeneratingImage(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || "",
        description: initialData.description || "",
        price: initialData.price || 0,
        imageUrl: initialData.imageUrl || "",
        tags: initialData.tags || [],
        isFeatured: initialData.isFeatured || false,
        isVisible: initialData.isVisible === false ? false : true,
      });
    }
  }, [initialData, form]);

  const imageUrlValue = form.watch('imageUrl');

  return (
    <TooltipProvider>
    <Card className="shadow-xl border-none">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-lg md:text-xl">{initialData?.id ? "Editar Producto" : "Añadir Nuevo Producto"}</CardTitle>
        <CardDesc>Rellena los detalles de tu producto de catálogo.</CardDesc>
      </CardHeader>
      <CardContent className="p-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6"> 
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Nombre del Producto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Chaqueta de Cuero Vintage, Granos de Café Orgánico" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe el producto, sus características, estado, etc."
                      {...field}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                    <FormItem className="w-full">
                    <FormLabel>Precio</FormLabel>
                    <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                        <Input type="number" placeholder="0.00" {...field} className="pl-8" />
                        </FormControl>
                    </div>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem className="w-full">
                   <FormLabel className="flex items-center gap-2">
                     URL de imagen de producto (Opcional)
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                           <p className="max-w-xs">Pega una URL, sube un archivo o genera una imagen con IA.</p>
                        </TooltipContent>
                      </Tooltip>
                  </FormLabel>
                   {(imageUrlValue || isGeneratingImage) && (
                    <div className="mt-2 relative w-48 h-32 rounded-md border flex items-center justify-center bg-muted">
                        {isGeneratingImage ? (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="text-xs">Generando...</span>
                            </div>
                        ) : (
                           <>
                             <img src={imageUrlValue} alt="Vista previa" className="rounded-md object-cover w-full h-full" />
                             <Button
                                 type="button"
                                 variant="destructive"
                                 size="icon"
                                 className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                 onClick={() => form.setValue("imageUrl", "")}
                             >
                                 <X className="h-4 w-4" />
                             </Button>
                           </>
                        )}
                    </div>
                  )}
                   <div className="flex items-center gap-2">
                    <FormControl>
                        <Input 
                        type="url" 
                        placeholder="https://placehold.co/600x400.png" 
                        {...field}
                        value={field.value ?? ""} 
                        />
                    </FormControl>
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <Button type="button" variant="outline" size="icon" onClick={handleGenerateImage} disabled={isUploading || isGeneratingImage} title="Generar imagen con IA">
                              {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                           </Button>
                        </TooltipTrigger>
                        <TooltipContent>Generar con IA</TooltipContent>
                     </Tooltip>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                     <Tooltip>
                       <TooltipTrigger asChild>
                           <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isGeneratingImage} title="Subir imagen">
                              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                           </Button>
                        </TooltipTrigger>
                        <TooltipContent>Subir archivo</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                           <Button type="button" variant="secondary" size="icon" onClick={handlePasteFromClipboard} title="Pegar URL del portapapeles">
                              <Clipboard className="h-4 w-4" />
                           </Button>
                        </TooltipTrigger>
                        <TooltipContent>Pegar URL</TooltipContent>
                    </Tooltip>
                  </div>
                  {isUploading && (
                    <div className="mt-2 space-y-1">
                      <Progress value={uploadProgress} />
                      <p className="text-xs text-muted-foreground">{Math.round(uploadProgress)}% subido...</p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={() => ( 
                <FormItem>
                 <FormLabel>Etiquetas ({tags.length}/10)</FormLabel>
                 <div className="flex flex-col md:flex-row items-start md:items-center gap-2 w-full"> 
                 <FormControl className="flex-grow w-full">
                        <Input
                        placeholder="Escribe una etiqueta y presiona Enter o ,"
                        value={currentTag.toLowerCase()} 
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={tags.length >= 10 || isLoading}
                        />
                    </FormControl>
                     <Button type="button" variant="outline" onClick={handleSuggestTags} disabled={isSuggestingTags}>
                         {isSuggestingTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Sugerir Etiquetas
                    </Button>
                  </div>
                   <FormMessage>{form.formState.errors.tags?.message || (form.formState.errors.tags as any)?.root?.message}</FormMessage>
                  <div className="mt-2 flex flex-wrap gap-1.5 w-full"> 
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs sm:text-sm py-1 px-2"> 
                        <span>{tag}</span> 
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="rounded-full outline-none ring-offset-background focus:ring-1 focus:ring-ring focus:ring-offset-1" 
                          aria-label={`Eliminar ${tag}`}
                           disabled={isLoading} 
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isFeatured"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Producto Destacado</FormLabel>
                      <FormDescription>
                        Los productos destacados se mostrarán en un carrusel.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isVisible"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Visible en Tienda</FormLabel>
                      <FormDescription>
                        Controla si este producto aparece en la tienda pública.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

             <Button type="submit" disabled={isLoading || isUploading || isGeneratingImage || isSuggestingTags} className="w-full sm:w-auto"> 
              {isLoading || isUploading || isGeneratingImage || isSuggestingTags ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {initialData?.id ? "Guardando..." : "Añadiendo..."}
                </>
              ) : (
                initialData?.id ? "Guardar Cambios" : "Añadir Producto"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
