
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
import { X, Lightbulb, Loader2 } from "lucide-react"; // Added Loader2
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
      if (currentTag.trim()) { // Only add if tag is not empty
        handleAddTag(currentTag);
      }
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
       } else if (uniqueSuggestions.length === 0 && result.tags.length === 0) {
            toast({
                title: "No Suggestions Found",
                description: "AI couldn't suggest any tags based on the description.",
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
     // Trim whitespace from tags before submitting
     const trimmedData = {
        ...data,
        tags: data.tags.map(tag => tag.trim()).filter(tag => tag), // Ensure no empty tags
     };
     await onSubmit(trimmedData, catalogId);
  };


  return (
    <Card>
      <CardHeader className="p-4 sm:p-6"> {/* Responsive padding */}
        <CardTitle className="text-lg sm:text-xl">{initialData?.id ? "Edit Item" : "Add New Item"}</CardTitle> {/* Responsive text size */}
      </CardHeader>
      <CardContent className="p-4 sm:p-6"> {/* Responsive padding */}
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
                  <FormLabel>Tags ({tags.length}/10)</FormLabel> {/* Show tag count */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2"> {/* Stack on small screens */}
                     <FormControl className="flex-grow">
                        <Input
                        placeholder="Add a tag and press Enter or ,"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={tags.length >= 10 || isSuggestingTags} // Disable while suggesting
                        />
                    </FormControl>
                    <Button
                        type="button"
                        variant="outline"
                        size="default" // Consistent button size
                        className="w-full sm:w-auto" // Full width on small screens
                        onClick={handleSuggestTags}
                        disabled={isSuggestingTags || !form.watch("description")} // Watch description
                        title="Suggest Tags (requires description)"
                    >
                        {isSuggestingTags ? (
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                           <Lightbulb className="mr-2 h-4 w-4" />
                        )}
                        Suggest Tags
                   </Button>
                  </div>
                   <FormMessage>{form.formState.errors.tags?.message}</FormMessage>
                  <div className="mt-2 flex flex-wrap gap-1.5"> {/* Adjusted gap */}
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs sm:text-sm"> {/* Responsive text */}
                        <span>{tag}</span> {/* Wrap text */}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="rounded-full outline-none ring-offset-background focus:ring-1 focus:ring-ring focus:ring-offset-1" // Adjusted focus ring
                          aria-label={`Remove ${tag}`}
                           disabled={isLoading || isSuggestingTags} // Disable while loading/suggesting
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                 {/* AI Tag Suggestions */}
                  {isSuggestingTags && (
                    <div className="mt-3 space-y-1"> {/* Adjusted margin */}
                       <Skeleton className="h-4 w-24 mb-2" /> {/* Adjusted margin */}
                       <div className="flex flex-wrap gap-2">
                         <Skeleton className="h-6 w-16 rounded-md" /> {/* Use md for consistency */}
                         <Skeleton className="h-6 w-20 rounded-md" />
                         <Skeleton className="h-6 w-12 rounded-md" />
                       </div>
                    </div>
                   )}
                  {!isSuggestingTags && suggestedTags.length > 0 && (
                    <div className="mt-3"> {/* Adjusted margin */}
                      <p className="text-sm font-medium text-muted-foreground mb-1.5">Suggestions:</p> {/* Adjusted margin */}
                      <div className="flex flex-wrap gap-1.5"> {/* Adjusted gap */}
                        {suggestedTags.map((tag) => (
                          <Button
                            key={tag}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddTag(tag)}
                            className="text-xs h-auto py-0.5 px-2"
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

             <Button type="submit" disabled={isLoading || isSuggestingTags} className="w-full sm:w-auto"> {/* Responsive button width */}
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {initialData?.id ? "Saving..." : "Adding..."}
                </>
              ) : (
                initialData?.id ? "Save Changes" : "Add Item"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
