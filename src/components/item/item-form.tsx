
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
import { X, Lightbulb, Loader2, Info, DollarSign, Sparkles, Search, Clipboard, Upload } from "lucide-react"; 
import type { Item } from "@/types";
import { suggestTags, type SuggestTagsInput, type SuggestTagsOutput } from '@/ai/flows/suggest-tags'; 
import { generateProductImage, type GenerateProductImageInput, type GenerateProductImageOutput } from '@/ai/flows/generate-product-image';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch";


const itemFormSchema = z.object({
  name: z.string().min(1, "El nombre del producto es obligatorio").max(100, "Nombre demasiado largo (máx. 100 caracteres)"),
  description: z.string().min(1, "La descripción es obligatoria").max(1000, "Descripción demasiado larga (máx. 1000 caracteres)"),
  price: z.coerce.number().min(0, "El precio debe ser un número positivo.").refine(val => val !== null && val !== undefined, { message: "El precio es obligatorio" }),
  imageUrl: z.string().optional().or(z.literal("")),
  tags: z.array(z.string().min(1, "La etiqueta no puede estar vacía.").max(50, "Etiqueta demasiado larga (máx. 50 caracteres).")).max(10, "Máximo 10 etiquetas permitidas."),
  isFeatured: z.boolean().default(false),
  isVisible: z.boolean().default(true),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

interface ItemFormProps {
  catalogId: string;
  onSubmit: (data: ItemFormValues) => Promise<void>; 
  initialData?: Partial<Item>;
  isLoading?: boolean;
}

export function ItemForm({ catalogId, onSubmit, initialData, isLoading = false }: ItemFormProps) {
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
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const tags = form.watch("tags");
  const itemName = form.watch("name");
  const itemDescription = form.watch("description");
  const imageUrlValue = form.watch("imageUrl");
  
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
      // Ensure the pasted text is a valid URL format before setting
      if (text.startsWith('http://') || text.startsWith('https://')) {
        form.setValue("imageUrl", text, { shouldValidate: true });
        setImagePreview(text);
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

  const handleSearchOnWeb = () => {
    const name = form.getValues("name");
    if (!name || name.trim().length < 3) {
      toast({
        title: "Nombre de Producto Requerido",
        description: "Por favor, introduce un nombre para el producto antes de buscar una imagen.",
        variant: "destructive",
      });
      return;
    }
    const query = encodeURIComponent(name);
    window.open(`https://www.google.com/search?q=${query}&tbm=isch`, '_blank');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      // Clear the URL input to give priority to the uploaded file
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
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality compression
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
        toast({ title: "Error", description: "No se pudo leer el archivo de imagen.", variant: "destructive"});
      };
      reader.readAsDataURL(file);
    }
    // Reset file input
    if (event.target) {
        event.target.value = '';
    }
  };


  const handleAddTag = (tagToAdd: string) => {
    const newTag = tagToAdd.trim().toLowerCase(); 
    if (newTag && !tags.map(t => t.toLowerCase()).includes(newTag) && tags.length < 10) {
      form.setValue("tags", [...tags, newTag], { shouldValidate: true });
    }
    setCurrentTag("");
    setSuggestedTags(suggestedTags.filter(t => t.toLowerCase() !== newTag)); 
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
    const descriptionValue = form.getValues("description");
    if (!descriptionValue || descriptionValue.trim().length < 10) { 
      toast({
        title: "Descripción Demasiado Corta",
        description: "Por favor, introduce una descripción más detallada del producto (al menos 10 caracteres) para sugerir etiquetas.",
        variant: "destructive",
      });
      return;
    }

    setIsSuggestingTags(true);
    setSuggestedTags([]); 

    try {
      const input: SuggestTagsInput = { itemDescription: descriptionValue };
      const result: SuggestTagsOutput = await suggestTags(input);
      
      const currentTagsLower = tags.map(t => t.toLowerCase());
      const newSuggestions = result.tags.filter(tag => !currentTagsLower.includes(tag.toLowerCase()));
      const uniqueSuggestions = Array.from(new Set(newSuggestions.map(t => t.toLowerCase()))); 
       
      setSuggestedTags(uniqueSuggestions);

      if (uniqueSuggestions.length === 0 && result.tags.length > 0) {
         toast({
           title: "No hay Nuevas Sugerencias",
           description: "La IA no encontró nuevas etiquetas relevantes. Intenta refinar tu descripción.",
         });
       } else if (uniqueSuggestions.length === 0 && result.tags.length === 0) {
            toast({
                title: "No se Encontraron Sugerencias",
                description: "La IA no pudo sugerir ninguna etiqueta para esta descripción.",
            });
       }
    } catch (error: any) {
      console.error("Error al sugerir etiquetas:", error);
       toast({
         title: "Fallo en la Sugerencia",
         description: error.message || "No se pudieron obtener sugerencias de etiquetas de la IA. Por favor, inténtalo de nuevo.",
         variant: "destructive",
       });
      setSuggestedTags([]);
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
    try {
        const input: GenerateProductImageInput = { name, description };
        const result: GenerateProductImageOutput = await generateProductImage(input);
        
        // When generating an image, we give it top priority
        setImagePreview(result.imageUrl);
        form.setValue("imageUrl", result.wasGenerated ? '' : result.imageUrl, { shouldValidate: true });

        if (result.wasGenerated) {
            toast({
                title: "¡Imagen Generada!",
                description: "La IA ha creado una imagen para tu producto.",
            });
        } else {
            toast({
                title: "Fallo en la Generación",
                description: "No se pudo generar una imagen con IA. Se ha asignado una imagen de respaldo.",
                variant: "default", 
            });
        }

    } catch (error: any) {
        console.error("Error al generar imagen:", error);
        toast({
            title: "Fallo en la Generación de Imagen",
            description: error.message || "No se pudo generar la imagen. Por favor, inténtalo de nuevo.",
            variant: "destructive",
        });
    } finally {
        setIsGeneratingImage(false);
    }
  };
  
  const handleSubmitForm: SubmitHandler<ItemFormValues> = async (data) => {
     // Give priority to the uploaded/generated image in the preview state
     const finalImageUrl = imagePreview && imagePreview.startsWith('data:image') 
        ? imagePreview 
        : data.imageUrl;

     const trimmedData = {
        ...data,
        imageUrl: finalImageUrl || "",
        tags: data.tags.map(tag => tag.trim()).filter(tag => tag), 
     };
     await onSubmit(trimmedData);
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

  useEffect(() => {
    // Sync preview when URL is manually changed in the input, but not if it's an upload
    if (imageUrlValue && !imageUrlValue.startsWith('data:image')) {
        setImagePreview(imageUrlValue);
    }
  }, [imageUrlValue]);


  return (
    <TooltipProvider>
    <Card className="shadow-xl">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-xl">{initialData?.id ? "Editar Producto" : "Añadir Nuevo Producto"}</CardTitle>
        <CardDesc>Rellena los detalles de tu producto de catálogo.</CardDesc>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-6"> 
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                           <p className="max-w-xs">Puedes pegar una URL o subir un archivo. Al subir, la imagen se optimizará.</p>
                        </TooltipContent>
                      </Tooltip>
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
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                     <Button type="button" variant="outline" size="sm" onClick={handleSearchOnWeb} disabled={!itemName || isLoading}>
                        <Search className="h-4 w-4 mr-2" /> Buscar en Web
                    </Button>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage || !itemName || isLoading}
                        >
                        {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        Generar con IA
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handlePasteFromClipboard}>
                        <Clipboard className="h-4 w-4 mr-2" />
                        Pegar
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
                        disabled={tags.length >= 10 || isSuggestingTags || isLoading}
                        />
                    </FormControl>
                    <FormControl>
                      <Button
                          type="button"
                          variant="outline"
                          size="default"
                          className="w-full md:w-auto flex-shrink-0" 
                          onClick={handleSuggestTags}
                          disabled={isSuggestingTags || !itemDescription || itemDescription.trim().length < 10 || isLoading}
                          title={!itemDescription || itemDescription.trim().length < 10 ? "Introduce una descripción (mín. 10 caracteres) para sugerir etiquetas" : "Sugerir etiquetas basadas en la descripción"}
                      >
                          {isSuggestingTags ? (
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                             <Lightbulb className="mr-2 h-4 w-4" />
                          )}
                          Sugerir Etiquetas
                     </Button>
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
                           disabled={isLoading || isSuggestingTags} 
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  {isSuggestingTags && (
                    <div className="mt-3 space-y-1"> 
                       <Skeleton className="h-4 w-24 mb-2" /> 
                       <div className="flex flex-wrap gap-2">
                         <Skeleton className="h-6 w-16 rounded-md" /> 
                         <Skeleton className="h-6 w-20 rounded-md" />
                         <Skeleton className="h-6 w-12 rounded-md" />
                       </div>
                    </div>
                   )}
                  {!isSuggestingTags && suggestedTags.length > 0 && (
                    <div className="mt-3"> 
                      <p className="text-sm font-medium text-muted-foreground mb-1.5">Sugerencias:</p> 
                      <div className="flex flex-wrap gap-1.5"> 
                        {suggestedTags.map((tag) => (
                          <Button
                            key={tag}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddTag(tag)}
                            className="text-xs h-auto py-1 px-2 font-normal" 
                             disabled={tags.length >= 10 || isLoading || isSuggestingTags}
                          >
                            + {tag}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
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

             <Button type="submit" disabled={isLoading || isSuggestingTags || isGeneratingImage} className="w-full sm:w-auto"> 
              {isLoading ? (
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
