
'use client';

import React from 'react';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function CartSummary() {
  const { cart, getCartTotal, setIsCartOpen } = useCart();
  const total = getCartTotal();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleClick = () => {
    setIsCartOpen(true);
  };

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4"
        >
          <Button
            size="lg"
            className="w-full max-w-md h-14 rounded-full shadow-2xl flex items-center justify-between text-base px-6"
            onClick={handleClick}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="h-6 w-6" />
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                  {itemCount}
                </span>
              </div>
              <span>Ver Carrito</span>
            </div>
            <span className="font-bold">${total.toFixed(2)}</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
