
"use client";

import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Customer } from "@/types";
import { Loader2, LocateFixed } from "lucide-react";
import React from "react";
import { useToast } from "@/hooks/use-toast";

const customerFormSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("Dirección de correo electrónico inválida."),
  phone: z.string().regex(/^[0-9+ ]{8,15}$/, "Número de teléfono inválido."),
  address: z.string().min(5, "La dirección debe tener al menos 5 caracteres."),
  geolocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerFormProps {
  onSubmit: (data: CustomerFormValues) => void;
  initialData?: Partial<Customer>;
  isLoading?: boolean;
  onCancel: () => void;
}

export function CustomerForm({ onSubmit, initialData, isLoading, onCancel }: CustomerFormProps) {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      geolocation: initialData?.geolocation || undefined,
    },
  });

  const { toast } = useToast();

  const handleGetGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          form.setValue("geolocation", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }, { shouldValidate: true });
          toast({
            title: "Ubicación Obtenida",
            description: "La ubicación se ha guardado correctamente.",
          });
        },
        (error) => {
          toast({
            title: "Error de Ubicación",
            description: "No se pudo obtener la ubicación. Asegúrate de haber concedido los permisos.",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Navegador no Compatible",
        description: "Tu navegador no soporta la geolocalización.",
        variant: "destructive",
      });
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Juan Pérez" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electrónico</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Ej: juan.perez@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="Ej: +54 9 11 12345678" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Calle Falsa 123, Springfield" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
            <FormLabel>Geolocalización (Opcional)</FormLabel>
            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={handleGetGeolocation}>
                    <LocateFixed className="mr-2 h-4 w-4" />
                    Obtener Ubicación Actual
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="geolocation.latitude"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Latitud</FormLabel>
                    <FormControl>
                        <Input type="number" readOnly {...field} placeholder="Latitud" />
                    </FormControl>
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="geolocation.longitude"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Longitud</FormLabel>
                    <FormControl>
                        <Input type="number" readOnly {...field} placeholder="Longitud" />
                    </FormControl>
                    </FormItem>
                )}
                />
            </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Guardando..." : "Guardar Cliente"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
