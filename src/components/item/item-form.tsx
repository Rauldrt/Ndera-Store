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
  name: z.string().min(1, "Item name is required").max(100, "Name is too long (max 100 characters)"),
  description: z.string().min(1, "Description is required").max(1000, "Description is too long (max 1000 characters)"),
  imageUrl: z.string().url("Invalid URL format. Please enter a valid https:// or http:// URL.").optional().or(z.literal("")),
  tags: z.array(z.string().min(1, "Tag cannot be empty.").max(50, "Tag is too long (max 50 characters).")).max(10, "Maximum 10 tags allowed."),
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
        title: "Description Too Short",
        description: "Please enter a more detailed item description (at least 10 characters) to suggest tags.",
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
           title: "No New Suggestions",
           description: "AI couldn't find any new relevant tags. Try refining your description.",
         });
       } else if (uniqueSuggestions.length === 0 && result.tags.length === 0) {
            toast({
                title: "No Suggestions Found",
                description: "AI couldn't suggest any tags for this description.",
            });
       }
    } catch (error: any) {
      console.error("Error suggesting tags:", error);
       toast({
         title: "Suggestion Failed",
         description: error.message || "Could not get AI tag suggestions. Please try again.",
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
      <CardHeader className="p-4 sm:p-6"> 
        <CardTitle className="text-lg sm:text-xl">{initialData?.id ? "Edit Item" : "Add New Item"}</CardTitle> 
        <CardDescription>Fill in the details for your catalog item.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6"> 
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-6"> {/* Increased space */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Vintage Leather Jacket, Organic Coffee Beans" {...field} />
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
                      placeholder="Describe the item, its features, condition, etc."
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
                  <FormLabel className="flex items-center">
                    Image URL (Optional)
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 ml-1.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>Provide a direct link (URL) to an image of the item. Ensure it starts with http:// or https://.</p>
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
                  <FormLabel>Tags ({tags.length}/10)</FormLabel> 
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2"> 
                     <FormControl className="flex-grow">
                        <Input
                        placeholder="Type a tag and press Enter or ,"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={tags.length >= 10 || isSuggestingTags || isLoading} 
                        />
                    </FormControl>
                    <Button
                        type="button"
                        variant="outline"
                        size="default" 
                        className="w-full sm:w-auto flex-shrink-0" 
                        onClick={handleSuggestTags}
                        disabled={isSuggestingTags || !itemDescription || itemDescription.trim().length < 10 || isLoading}
                        title={!itemDescription || itemDescription.trim().length < 10 ? "Enter a description (min 10 chars) to suggest tags" : "Suggest tags based on description"}
                    >
                        {isSuggestingTags ? (
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                           <Lightbulb className="mr-2 h-4 w-4" />
                        )}
                        Suggest Tags
                   </Button>
                  </div>
                   <FormMessage>{form.formState.errors.tags?.message || (form.formState.errors.tags as any)?.root?.message}</FormMessage>
                  <div className="mt-2 flex flex-wrap gap-1.5"> 
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs sm:text-sm py-1 px-2"> 
                        <span>{tag}</span> 
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="rounded-full outline-none ring-offset-background focus:ring-1 focus:ring-ring focus:ring-offset-1" 
                          aria-label={`Remove ${tag}`}
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
                      <p className="text-sm font-medium text-muted-foreground mb-1.5">Suggestions:</p> 
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
    </TooltipProvider>
  );
}

