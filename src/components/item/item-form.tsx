"use client";

import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import React, { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { X, Lightbulb } from "lucide-react";
import type { Item } from "@/types";
import { suggestTags, type SuggestTagsInput, type SuggestTagsOutput } from '@/ai/flows/suggest-tags'; // Import AI flow
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const itemFormSchema = z.object({
  name: z.string().min(1, "Item name is required").max(100, "Name too long"),
  description: z.string().min(1, "Description is required").max(1000, "Description too long"),
  imageUrl: z.string().url("Invalid URL format").optional().or(z.literal("")),
  tags: z.array(z.string().min(1).max(50)).max(10, "Maximum 10 tags allowed"),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

interface ItemFormProps {
  catalogId: string;
  onSubmit: (data: ItemFormValues, catalogId: string) => Promise<void>; // Make onSubmit async
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

  const handleAddTag = (tagToAdd: string) => {
    const newTag = tagToAdd.trim();
    if (newTag && !tags.includes(newTag) && tags.length < 10) {
      form.setValue("tags", [...tags, newTag], { shouldValidate: true });
    }
    setCurrentTag("");
    setSuggestedTags(suggestedTags.filter(t => t !== newTag)); // Remove added tag from suggestions
  };

  const handleRemoveTag = (tagToRemove: string) => {
    form.setValue(
      "tags",
      tags.filter((tag) => tag !== tagToRemove),
      { shouldValidate: true }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(currentTag);
    }
  };

   const handleSuggestTags = async () => {
    const description = form.getValues("description");
    if (!description) {
      toast({
        title: "Description Needed",
        description: "Please enter an item description to suggest tags.",
        variant: "destructive",
      });
      return;
    }

    setIsSuggestingTags(true);
    setSuggestedTags([]); // Clear previous suggestions

    try {
      const input: SuggestTagsInput = { itemDescription: description };
      const result: SuggestTagsOutput = await suggestTags(input);
      // Filter out tags already added and duplicates from suggestion
      const newSuggestions = result.tags.filter(tag => !tags.includes(tag));
      const uniqueSuggestions = Array.from(new Set(newSuggestions));
       setSuggestedTags(uniqueSuggestions);
      if (uniqueSuggestions.length === 0 && result.tags.length > 0) {
         toast({
           title: "No New Suggestions",
           description: "AI couldn't find any new relevant tags.",
         });
       }
    } catch (error) {
      console.error("Error suggesting tags:", error);
       toast({
         title: "Suggestion Failed",
         description: "Could not get AI tag suggestions. Please try again.",
         variant: "destructive",
       });
      setSuggestedTags([]);
    } finally {
      setIsSuggestingTags(false);
    }
  };

  const handleSubmit: SubmitHandler<ItemFormValues> = async (data) => {
     await onSubmit(data, catalogId);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData?.id ? "Edit Item" : "Add New Item"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Laptop, Novel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the item..."
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
                <FormItem>
                  <FormLabel>Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://example.com/image.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags Input */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <div className="flex items-center gap-2">
                     <FormControl>
                        <Input
                        placeholder="Add a tag and press Enter or ,"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={tags.length >= 10}
                        />
                    </FormControl>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleSuggestTags}
                        disabled={isSuggestingTags || !form.getValues("description")}
                        title="Suggest Tags (requires description)"
                    >
                        <Lightbulb className={`h-4 w-4 ${isSuggestingTags ? 'animate-pulse' : ''}`} />
                   </Button>
                  </div>
                   <FormMessage>{form.formState.errors.tags?.message}</FormMessage>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          aria-label={`Remove ${tag}`}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                 {/* AI Tag Suggestions */}
                  {isSuggestingTags && (
                    <div className="mt-2 space-y-1">
                       <Skeleton className="h-4 w-24" />
                       <div className="flex flex-wrap gap-2">
                         <Skeleton className="h-6 w-16 rounded-full" />
                         <Skeleton className="h-6 w-20 rounded-full" />
                         <Skeleton className="h-6 w-12 rounded-full" />
                       </div>
                    </div>
                   )}
                  {!isSuggestingTags && suggestedTags.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Suggestions:</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedTags.map((tag) => (
                          <Button
                            key={tag}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddTag(tag)}
                            className="text-xs h-auto py-0.5 px-2"
                             disabled={tags.length >= 10}
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

            <Button type="submit" disabled={isLoading || isSuggestingTags}>
              {isLoading ? (initialData?.id ? "Saving..." : "Adding...") : (initialData?.id ? "Save Changes" : "Add Item")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
