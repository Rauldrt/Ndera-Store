
"use client";

import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Lightbulb, Loader2, Info } from "lucide-react"; 
import type { Item } from "@/types";
import { suggestTags, type SuggestTagsInput, type SuggestTagsOutput } from '@/ai/flows/suggest-tags'; 
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


const itemFormSchema = z.object({
  name: z.string().min(1, "El nombre del producto es obligatorio").max(100, "Nombre demasiado largo (máx. 100 caracteres)"),
  description: z.string().min(1, "La descripción es obligatoria").max(1000, "Descripción demasiado larga (máx. 1000 caracteres)"),
  imageUrl: z.string().url("Formato de URL inválido. Por favor, introduce una URL válida https:// o http://.").optional().or(z.literal("")),
  tags: z.array(z.string().min(1, "La etiqueta no puede estar vacía.").max(50, "Etiqueta demasiado larga (máx. 50 caracteres).")).max(10, "Máximo 10 etiquetas permitidas."),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

interface ItemFormProps {
  catalogId: string;
  onSubmit: (data: ItemFormValues) => Promise<void>; // Removed catalogId from onSubmit args as it's passed directly
  initialData?: Partial<Item>;
  isLoading?: boolean;
}

export function ItemForm({ catalogId, onSubmit, initialData, isLoading = false }: ItemFormProps) {
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      imageUrl: initialData?.imageUrl || "",
      tags: initialData?.tags || [],
    },
  });

  const [currentTag, setCurrentTag] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  const { toast } = useToast();

  const tags = form.watch("tags");
  const itemDescription = form.watch("description"); // Watch description for enabling suggest button

  const handleAddTag = (tagToAdd: string) => {
    const newTag = tagToAdd.trim().toLowerCase(); // Normalize to lowercase
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
    if (!descriptionValue || descriptionValue.trim().length < 10) { // Require minimum length for description
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
      const uniqueSuggestions = Array.from(new Set(newSuggestions.map(t => t.toLowerCase()))); // Store unique suggestions as lowercase
       
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

  const handleSubmitForm: SubmitHandler<ItemFormValues> = async (data) => {
     const trimmedData = {
        ...data,
        tags: data.tags.map(tag => tag.trim()).filter(tag => tag), 
     };
     await onSubmit(trimmedData);
  };

   useEffect(() => {
    // Reset form if initialData changes (e.g., when switching from add to edit)
    form.reset({
      name: initialData?.name || "",
      description: initialData?.description || "",
      imageUrl: initialData?.imageUrl || "",
      tags: initialData?.tags || [],
    });
  }, [initialData, form.reset, form]);


  return (
    <TooltipProvider>
    <Card className="shadow-xl">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-xl">{initialData?.id ? "Editar Producto" : "Añadir Nuevo Producto"}</CardTitle>
        <CardDescription>Rellena los detalles de tu producto de catálogo.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-6"> {/* Increased space */}
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
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel className="flex items-center">
                    URL de la Imagen (Opcional)
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 ml-1.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>Proporciona un enlace directo (URL) a una imagen del producto. Asegúrate de que empiece por http:// o https://.</p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://picsum.photos/seed/example/400/300" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={() => ( // field is not directly used here, manage via form.watch and form.setValue
                <FormItem>
 <FormLabel>Etiquetas ({tags.length}/10)</FormLabel>
 <div className="flex flex-col md:flex-row items-start md:items-center gap-2 w-full"> {/* Ensure the container takes full width */}
 <FormControl className="flex-grow w-full">
                        <Input
                        placeholder="Escribe una etiqueta y presiona Enter o ,"
                        value={currentTag.toLowerCase()} // Display in lowercase
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
                  <div className="mt-2 flex flex-wrap gap-1.5 w-full"> {/* Allow tags to wrap and take full width, already had flex-wrap*/}
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
                            className="text-xs h-auto py-1 px-2 font-normal" // Adjusted styling
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

             <Button type="submit" disabled={isLoading || isSuggestingTags} className="w-full sm:w-auto"> 
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



    