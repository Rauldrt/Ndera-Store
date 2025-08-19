
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
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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
          const MAX_WIDTH = 1200; // Larger for catalog background
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
          setImagePreview(dataUrl); // This is the fix
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
      // Ensure the pasted text is a valid URL format before setting
      if (text.startsWith('http://') || text.startsWith('https://')) {
        form.setValue("imageUrl", text, { shouldValidate: true });
        setImagePreview(text); // Update preview with pasted URL
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

  const handleSubmit = (data: CatalogFormValues) => {
    // Give priority to the uploaded/generated image in the preview state
    const finalImageUrl = imagePreview && imagePreview.startsWith('data:image') 
        ? imagePreview 
        : data.imageUrl;

    onSubmit({
      ...data,
      imageUrl: finalImageUrl || "",
    });
  };
  
  const imageUrlValue = form.watch('imageUrl');

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

  useEffect(() => {
    // Sync preview when URL is manually changed in the input, but not if it's an upload
    if (imageUrlValue && !imageUrlValue.startsWith('data:image')) {
        setImagePreview(imageUrlValue);
    }
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
                     URL de imagen de fondo (Opcional)
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
                        placeholder="https://placehold.co/600x400.png" 
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
            <Button type="submit" disabled={isLoading || isUploading}>
              {isLoading || isUploading ? (initialData?.id ? "Guardando..." : "Creando...") : (initialData?.id ? "Guardar Cambios" : "Crear Catálogo")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
