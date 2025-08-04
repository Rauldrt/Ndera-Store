
"use client";

import React from 'react';
import type { Item } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ImageOff } from 'lucide-react';

interface ItemDetailModalProps {
  item: Item | null;
  onClose: () => void;
}

export function ItemDetailModal({ item, onClose }: ItemDetailModalProps) {
  if (!item) {
    return null;
  }

  return (
    <Dialog open={!!item} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="aspect-video relative bg-muted rounded-md overflow-hidden mb-4 group">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
                data-ai-hint="product photo"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted via-background to-muted">
                <ImageOff size={48} />
              </div>
            )}
          </div>
          <DialogTitle className="text-2xl font-bold">{item.name}</DialogTitle>
          <DialogDescription className="text-xl font-semibold text-primary">
            ${(item.price ?? 0).toFixed(2)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div>
                <h4 className="font-semibold mb-2">Descripción</h4>
                <p className="text-sm text-muted-foreground">{item.description || 'Sin descripción.'}</p>
            </div>

            {Array.isArray(item.tags) && item.tags.length > 0 && (
                <div>
                    <h4 className="font-semibold mb-2">Etiquetas</h4>
                    <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                    </div>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
