
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
import { X, Loader2, DollarSign, Upload, Clipboard } from "lucide-react"; 
import type { Item } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

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
  onSubmit: (data: ItemFormValues) => void;
  isLoading?: boolean;
}

export function ItemForm({ initialData, onSubmit, isLoading = false }: ItemFormProps) {
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

  const [currentTag, setCurrentTag] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const tags = form.watch("tags");
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      form.setValue('imageUrl', '', { shouldValidate: true });

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round(height * (MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round(width * (MAX_HEIGHT / height));
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setImagePreview(dataUrl);
          setIsUploading(false);
          toast({
            title: "Imagen Cargada",
            description: "La imagen ha sido optimizada y está lista.",
          });
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        setIsUploading(false);
        toast({ title: "Error", description: "No se pudo leer el archivo de imagen.", variant: "destructive" });
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
        event.target.value = ''; // Reset file input
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
        setImagePreview(text);
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
        description: "No se pudo leer el portapapeles.",
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
  
  const handleSubmit: SubmitHandler<ItemFormValues> = (data) => {
    let finalData = { ...data };
    
    // Prioritize the base64-encoded image preview if it exists
    if (imagePreview && imagePreview.startsWith('data:image')) {
      finalData.imageUrl = imagePreview;
    } else {
      // Otherwise, use the URL from the form field
      finalData.imageUrl = data.imageUrl;
    }
  
    const trimmedData = {
      ...finalData,
      tags: data.tags.map(tag => tag.trim()).filter(Boolean),
    };

    onSubmit(trimmedData);
  };

   useEffect(() => {
    form.reset({
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price || 0,
      imageUrl: initialData?.imageUrl || "",
      tags: initialData?.tags || [],
      isFeatured: initialData?.isFeatured || false,
      isVisible: initialData?.isVisible === false ? false : true,
    });
    setImagePreview(initialData?.imageUrl || null);
  }, [initialData, form]);

  const imageUrlValue = form.watch('imageUrl');

  useEffect(() => {
    // This syncs the preview if the URL field is changed manually
    if (imageUrlValue && !imageUrlValue.startsWith('data:image')) {
        setImagePreview(imageUrlValue);
    } else if (!imageUrlValue && !isUploading) {
        // Clear preview if URL is cleared and not currently uploading
        setImagePreview(null);
    }
  }, [imageUrlValue]);


  return (
    <Card className="shadow-xl border-none">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-lg md:text-xl">{initialData?.id ? "Editar Producto" : "Añadir Nuevo Producto"}</CardTitle>
        <CardDesc>Rellena los detalles de tu producto de catálogo.</CardDesc>
      </CardHeader>
      <CardContent className="p-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6"> 
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
            
            {imagePreview && (
              <div className="mt-2 relative w-32 h-32">
                <img src={imagePreview} alt="Vista previa" className="rounded-md object-cover w-full h-full" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => {
                    setImagePreview(null);
                    form.setValue("imageUrl", "");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem className="w-full">
                   <FormLabel className="flex items-center gap-2">
                    URL de la imagen o Subir Archivo
                  </FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                        <Input 
                            type="url" 
                            placeholder="https://placehold.co/400x300.png" 
                            {...field}
                        />
                    </FormControl>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                    <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading} title="Subir imagen">
                       {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                     <Button type="button" variant="secondary" size="icon" onClick={handlePasteFromClipboard} title="Pegar URL">
                        <Clipboard className="h-4 w-4" />
                    </Button>
                  </div>
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

             <Button type="submit" disabled={isLoading || isUploading} className="w-full sm:w-auto"> 
              {isLoading || isUploading ? (
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
  );
}
