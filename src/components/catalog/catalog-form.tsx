
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Catalog } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
            title: "Archivo Demasiado Grande",
            description: "Por favor, sube una imagen de menos de 2MB.",
            variant: "destructive",
        });
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result as string;
        form.setValue("imageUrl", base64String, { shouldValidate: true });
        setImagePreview(base64String);
    };
    reader.readAsDataURL(file);
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

  return (
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
                <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Subir Imagen
                </Button>
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
                  <FormLabel>O pega una URL de imagen (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="url" 
                      placeholder="https://placehold.co/600x400.png" 
                      {...field} 
                       onChange={(e) => {
                          field.onChange(e);
                          setImagePreview(e.target.value);
                       }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (initialData?.id ? "Guardando..." : "Creando...") : (initialData?.id ? "Guardar Cambios" : "Crear Catálogo")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
