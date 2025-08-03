'use client';

import React, { useState } from 'react';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ShoppingCart, Trash2, Plus, Minus, PackageX, CreditCard, Download, Send, LocateFixed, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { CartItem } from '@/types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';


const SAVED_SHIPPING_INFO_KEY = 'savedShippingInfo';

const quoteSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres.'),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;


export function CartSheet() {
  const { cart, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();
  const { toast } = useToast();
  const total = getCartTotal();
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [geolocation, setGeolocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      name: '',
      address: '',
    },
  });

  React.useEffect(() => {
    if (isQuoteDialogOpen) {
      try {
        const savedInfoRaw = localStorage.getItem(SAVED_SHIPPING_INFO_KEY);
        if (savedInfoRaw) {
          const savedInfo = JSON.parse(savedInfoRaw);
          form.reset({
            name: savedInfo.name || '',
            address: savedInfo.address || '',
          });
          if (savedInfo.geolocation) {
            setGeolocation(savedInfo.geolocation);
          }
        }
      } catch (error) {
        console.error("Error al cargar la información de envío guardada:", error);
      }
    }
  }, [isQuoteDialogOpen, form]);


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

  const generateQuotePDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Producto", "Cantidad", "Precio Unitario", "Subtotal"];
    const tableRows = cart.map(item => [
      item.name,
      item.quantity,
      `$${item.price.toFixed(2)}`,
      `$${(item.price * item.quantity).toFixed(2)}`
    ]);

    doc.setFontSize(18);
    doc.text('Presupuesto de Productos', 14, 22);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });
    
    const finalY = (doc as any).lastAutoTable.finalY || 30;
    doc.setFontSize(12);
    doc.text(`Total: $${total.toFixed(2)}`, 14, finalY + 10);
    doc.save(`presupuesto-${new Date().getTime()}.pdf`);
  };

  const handleGetGeolocation = () => {
    if (navigator.geolocation) {
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeolocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          toast({
            title: "Ubicación Obtenida",
            description: "Tu ubicación se ha guardado correctamente.",
          });
          setIsGettingLocation(false);
        },
        (error) => {
          toast({
            title: "Error de Ubicación",
            description: "No se pudo obtener tu ubicación. Asegúrate de haber concedido los permisos.",
            variant: "destructive",
          });
          setIsGettingLocation(false);
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

  const onQuoteSubmit = (data: QuoteFormValues) => {
    const shippingInfoToSave = {
      ...data,
      geolocation: geolocation,
    };
    try {
      localStorage.setItem(SAVED_SHIPPING_INFO_KEY, JSON.stringify(shippingInfoToSave));
    } catch (error) {
      console.error("Error al guardar la información de envío:", error);
    }

    let message = `¡Hola! Quisiera solicitar un presupuesto para los siguientes productos:\n\n`;
    message += `*Cliente:* ${data.name}\n`;
    message += `*Dirección:* ${data.address}\n`;
    if (geolocation) {
        const { latitude, longitude } = geolocation;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        message += `*Ubicación:* ${mapsUrl}\n`;
    }
    message += `\n------------------------\n\n`;

    cart.forEach(item => {
      message += `*${item.name}*\n`;
      message += `Cantidad: ${item.quantity}\n`;
      message += `Precio: $${(item.price * item.quantity).toFixed(2)}\n\n`;
    });
    message += `*Total estimado: $${total.toFixed(2)}*`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    setIsQuoteDialogOpen(false);
  };


  return (
    <>
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
                        <img
                          src={item.imageUrl || `https://placehold.co/100x100.png`}
                          alt={item.name}
                          className="object-cover w-full h-full"
                          data-ai-hint="product photo"
                          loading="lazy"
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
                  <SheetClose asChild>
                    <Link href="/checkout">
                      <Button className="w-full mt-2">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Ir a Pagar
                      </Button>
                    </Link>
                  </SheetClose>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={generateQuotePDF}>
                        <Download className="mr-2 h-4 w-4" />
                        Presupuesto
                    </Button>
                    <Button variant="secondary" onClick={() => setIsQuoteDialogOpen(true)}>
                        <Send className="mr-2 h-4 w-4" />
                        WhatsApp
                    </Button>
                  </div>
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

      <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar para Enviar Presupuesto</DialogTitle>
            <DialogDescription>
              Necesitamos algunos datos para generar el mensaje de WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onQuoteSubmit)} className="space-y-4 pt-4">
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
                <Button type="button" variant="outline" size="sm" onClick={handleGetGeolocation} disabled={isGettingLocation}>
                  {isGettingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                  Obtener Ubicación Actual
                </Button>
                {geolocation && (
                  <p className="text-xs text-muted-foreground">
                    Ubicación guardada: {geolocation.latitude.toFixed(4)}, {geolocation.longitude.toFixed(4)}
                  </p>
                )}
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button type="submit">
                  <Send className="mr-2 h-4 w-4" />
                  Enviar por WhatsApp
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
