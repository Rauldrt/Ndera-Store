
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { CartItem } from '@/types';

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  shippingCost: number; // Export shipping cost for display
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

interface CartProviderProps {
  children: ReactNode;
}

const SHIPPING_COST = 5.00; // Define a fixed shipping cost

export function CartProvider({ children }: CartProviderProps) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('shoppingCart');
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (itemToAdd: CartItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === itemToAdd.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...itemToAdd, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart((prevCart) =>
        prevCart.map((item) => (item.id === itemId ? { ...item, quantity } : item))
      );
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
    // Add shipping cost only if there are items in the cart
    return cart.length > 0 ? subtotal + SHIPPING_COST : 0;
  };

  return (
    <CartContext.Provider
      value={{ 
          cart, 
          addToCart, 
          removeFromCart, 
          updateQuantity, 
          clearCart, 
          getCartTotal,
          shippingCost: cart.length > 0 ? SHIPPING_COST : 0, // Provide shipping cost based on cart content
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
