
'use client';

import React from 'react';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { AnimatePresence, motion } from 'framer-motion';

export function CartSummary({ children }: { children: React.ReactNode }) {
  const { cart, getCartTotal } = useCart();
  const total = getCartTotal();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
