
'use client';

import React from 'react';
import Image from 'next/image';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ShoppingCart, Trash2, Plus, Minus, PackageX, FileDown } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { CartItem } from '@/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


// Extend the jsPDF type to include autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

// WhatsApp Icon Component
const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
  );


export function CartSheet() {
  const { cart, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();
  const total = getCartTotal();
  
  const handleIncreaseQuantity = (itemId: string) => {
    const itemInCart = cart.find(cartItem => cartItem.id === itemId);
    if (itemInCart) {
      updateQuantity(itemId, itemInCart.quantity + 1);
    }
  };

  const handleDecreaseQuantity = (itemId: string) => {
    const itemInCart = cart.find(cartItem => cartItem.id === itemId);
    if (itemInCart) {
      updateQuantity(itemId, itemInCart.quantity - 1);
    }
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF() as jsPDFWithAutoTable;

    // Check if all items in the cart are from the same catalog
    let catalogName = 'Catalogify';
    if (cart.length > 0) {
      const firstCatalogName = cart[0].catalogName;
      const allSameCatalog = cart.every(item => item.catalogName === firstCatalogName);
      if (allSameCatalog && firstCatalogName) {
        catalogName = firstCatalogName;
      }
    }

    // Add header
    doc.setFontSize(20);
    doc.text(`Presupuesto - ${catalogName}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Add table
    doc.autoTable({
        startY: 40,
        head: [['Cantidad', 'Producto', 'Precio Unitario', 'Total']],
        body: cart.map(item => [
            item.quantity,
            item.name,
            `$${item.price.toFixed(2)}`,
            `$${(item.price * item.quantity).toFixed(2)}`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [34, 48, 62] },
    });

    // Add total
    const finalY = doc.autoTable.previous.finalY;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: $${total.toFixed(2)}`, 14, finalY + 15);

    // Save PDF
    doc.save(`presupuesto-${catalogName.replace(/\s+/g, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleSendWhatsApp = () => {
    const phoneNumber = "1234567890"; // Reemplazar con el número de teléfono de destino
    
    let message = "Hola, estoy interesado en un presupuesto para los siguientes productos:\n\n";
    cart.forEach(item => {
        message += `*${item.name}*\n`;
        message += `Cantidad: ${item.quantity}\n`;
        message += `Precio: $${(item.price * item.quantity).toFixed(2)}\n\n`;
    });
    message += `*Total del Presupuesto: $${total.toFixed(2)}*`;

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };


  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
              {cart.reduce((total, item) => total + item.quantity, 0)}
            </span>
          )}
          <span className="sr-only">Abrir carrito de compras</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col pr-0 sm:max-w-lg">
        <SheetHeader className="px-6">
          <SheetTitle>Tu Carrito ({cart.reduce((total, item) => total + item.quantity, 0)} productos)</SheetTitle>
        </SheetHeader>
        {cart.length > 0 ? (
          <>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-6 p-6 pr-8">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border">
                      <Image
                        src={item.imageUrl || `https://placehold.co/100x100.png`}
                        alt={item.name}
                        fill
                        className="object-cover"
                        data-ai-hint="product photo"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-sm line-clamp-2">{item.name}</h4>
                      <p className="text-sm font-bold text-foreground">${item.price.toFixed(2)}</p>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center justify-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleDecreaseQuantity(item.id)}>
                              <Minus className="h-3.5 w-3.5" />
                              <span className="sr-only">Disminuir cantidad</span>
                            </Button>
                            <span className="font-bold text-base w-8 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleIncreaseQuantity(item.id)}>
                              <Plus className="h-3.5 w-3.5" />
                              <span className="sr-only">Aumentar cantidad</span>
                            </Button>
                         </div>
                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                           <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Eliminar producto</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <SheetFooter className="mt-auto border-t bg-background/95 p-6">
              <div className="flex w-full flex-col gap-3">
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-full mt-2">
                      Solicitar Presupuesto
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuItem onClick={handleDownloadPdf}>
                      <FileDown className="mr-2 h-4 w-4" />
                      <span>Descargar Presupuesto (PDF)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSendWhatsApp}>
                       <WhatsAppIcon className="mr-2 h-4 w-4" />
                      <span>Enviar por WhatsApp</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" className="w-full" onClick={clearCart}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Vaciar Carrito
                </Button>
              </div>
            </SheetFooter>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <PackageX className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Tu carrito está vacío</h3>
            <p className="text-muted-foreground text-sm">Parece que aún no has añadido ningún producto.</p>
            <SheetClose asChild>
                <Link href="/items">
                    <Button variant="default" className="mt-4">
                        Seguir comprando
                    </Button>
                </Link>
            </SheetClose>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
