"use client";

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

const catalogFormSchema = z.object({
  name: z.string().min(1, "Catalog name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
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
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData?.id ? "Edit Catalog" : "Create New Catalog"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Catalog Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Electronics, Books" {...field} />
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the catalog..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (initialData?.id ? "Saving..." : "Creating...") : (initialData?.id ? "Save Changes" : "Create Catalog")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
