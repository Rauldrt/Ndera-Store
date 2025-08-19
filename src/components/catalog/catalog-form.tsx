
"use client";

import { useRef, useState, useEffect } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Catalog } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Loader2, Info, Clipboard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const catalogFormSchema = z.object({
  name: z.string().min(1, "El nombre del catálogo es obligatorio").max(100, "Nombre demasiado largo"),
  description: z.string().max(500, "Descripción demasiado larga").optional(),
  imageUrl: z.string().url("Formato de URL inválido. Por favor, introduce una URL válida https:// o http://.").optional().or(z.literal("")),
});

type CatalogFormValues = z.infer<typeof catalogFormSchema>;

interface CatalogFormProps {
  onSubmit: SubmitHandler<CatalogFormValues>;
  initialData?: Partial<Catalog>;
  isLoading?: boolean;
}

export function CatalogForm({ onSubmit, initialData, isLoading = false }: CatalogFormProps) {
  const form = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      imageUrl: initialData?.imageUrl || "",
    },
  });

  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        toast({
            title: "Archivo no Soportado",
            description: "Por favor, selecciona un archivo de imagen.",
            variant: "destructive",
        });
        return;
    }
    
    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
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
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

            // ~1MB limit in Firestore for a string
            if (dataUrl.length > 1048487) {
                 toast({
                    title: "Imagen Demasiado Grande",
                    description: "Incluso después de la optimización, la imagen es demasiado grande. Por favor, elige una más pequeña.",
                    variant: "destructive",
                });
                setIsProcessingImage(false);
                return;
            }

            form.setValue("imageUrl", dataUrl, { shouldValidate: true });
            setImagePreview(dataUrl);
            setIsProcessingImage(false);
        };
        img.onerror = () => {
            toast({
                title: "Error de Imagen",
                description: "No se pudo cargar el archivo de imagen.",
                variant: "destructive",
            });
            setIsProcessingImage(false);
        };
        img.src = e.target?.result as string;
    };
    reader.onerror = () => {
        toast({
            title: "Error de Archivo",
            description: "No se pudo leer el archivo seleccionado.",
            variant: "destructive",
        });
        setIsProcessingImage(false);
    };
    reader.readAsDataURL(file);
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
      form.setValue("imageUrl", text, { shouldValidate: true });
      setImagePreview(text);
      toast({
        title: "Enlace Pegado",
        description: "Se ha pegado la URL desde tu portapapeles.",
      });
    } catch (error) {
      console.error("Error al pegar desde el portapapeles:", error);
      toast({
        title: "Error al Pegar",
        description: "No se pudo leer el portapapeles. Asegúrate de haber concedido permisos.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (data: CatalogFormValues) => {
    onSubmit({
      ...data,
      imageUrl: imagePreview || data.imageUrl,
    });
  };

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || "",
        description: initialData.description || "",
        imageUrl: initialData.imageUrl || "",
      });
      setImagePreview(initialData.imageUrl || null);
    }
  }, [initialData, form]);

  const imageUrlValue = form.watch('imageUrl');

  useEffect(() => {
    // Sync preview when URL is pasted manually
    setImagePreview(imageUrlValue || null);
  }, [imageUrlValue]);

  return (
    <TooltipProvider>
    <Card>
      <CardHeader>
        <CardTitle>{initialData?.id ? "Editar Catálogo" : "Crear Nuevo Catálogo"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Nombre del Catálogo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Electrónica, Libros" {...field} />
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
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe el catálogo..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
                <FormLabel>Imagen de Fondo</FormLabel>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isProcessingImage || isLoading}>
                        {isProcessingImage ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        {isProcessingImage ? 'Procesando...' : 'Subir Imagen'}
                    </Button>
                     <Button type="button" variant="secondary" onClick={handlePasteFromClipboard}>
                        <Clipboard className="mr-2 h-4 w-4" />
                        Pegar Enlace
                    </Button>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/png, image/jpeg, image/webp"
                />
            </div>

             {imagePreview && (
                <div className="mt-2 relative w-48 h-32">
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
                     O pega una URL de imagen (Opcional)
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                           <p className="max-w-xs">En móvil: mantén pulsada una imagen, selecciona 'Abrir en pestaña nueva' y copia la URL de esa pestaña.</p>
                        </TooltipContent>
                      </Tooltip>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="url" 
                      placeholder="https://placehold.co/600x400.png" 
                      {...field} 
                       onChange={(e) => {
                          field.onChange(e);
                       }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading || isProcessingImage}>
              {isLoading ? (initialData?.id ? "Guardando..." : "Creando...") : (initialData?.id ? "Guardar Cambios" : "Crear Catálogo")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
