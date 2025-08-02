
'use client';

import React from 'react';
import { useCart } from '@/context/cart-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard, Landmark, Wallet } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';


const shippingSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres.'),
  phone: z.string().regex(/^[0-9+ ]{8,15}$/, 'Número de teléfono inválido.'),
  email: z.string().email('Dirección de correo electrónico inválida.'),
});

const paymentSchema = z.object({
  paymentMethod: z.enum(['transfer', 'cash'], {
    required_error: 'Debes seleccionar un método de pago.',
  }),
});

const checkoutSchema = shippingSchema.extend({
  ...paymentSchema.shape,
  saveInfo: z.boolean().default(false).optional(),
});


type CheckoutFormValues = z.infer<typeof checkoutSchema>;

const SAVED_SHIPPING_INFO_KEY = 'savedShippingInfo';
const ORDER_DETAILS_KEY = 'orderDetails';


export default function CheckoutPage() {
  const { cart, getCartTotal, clearCart } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const total = getCartTotal();

  const methods = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
      paymentMethod: undefined,
      saveInfo: false,
    },
  });

  // Cargar datos guardados al montar el componente
  React.useEffect(() => {
    try {
      const savedInfoRaw = localStorage.getItem(SAVED_SHIPPING_INFO_KEY);
      if (savedInfoRaw) {
        const savedInfo = JSON.parse(savedInfoRaw);
        // Rellenar el formulario con los datos guardados
        methods.reset({
          name: savedInfo.name || '',
          address: savedInfo.address || '',
          phone: savedInfo.phone || '',
          email: savedInfo.email || '',
          saveInfo: true, // Marcar la casilla si se encontraron datos
        });
      }
    } catch (error) {
      console.error("Error al cargar la información de envío guardada:", error);
    }
  }, [methods]);


  const onSubmit = (data: CheckoutFormValues) => {
    setIsLoading(true);

    if (data.saveInfo) {
      const shippingInfoToSave = {
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
      };
      try {
        localStorage.setItem(SAVED_SHIPPING_INFO_KEY, JSON.stringify(shippingInfoToSave));
      } catch (error) {
        console.error("Error al guardar la información de envío:", error);
      }
    } else {
      localStorage.removeItem(SAVED_SHIPPING_INFO_KEY);
    }
    
    const orderDetails = {
      shipping: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
      },
      paymentMethod: data.paymentMethod,
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      total,
      orderDate: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(ORDER_DETAILS_KEY, JSON.stringify(orderDetails));
    } catch (error) {
        console.error("Error al guardar los detalles del pedido:", error);
        toast({
            title: 'Error Inesperado',
            description: 'No se pudo procesar el pedido. Por favor, inténtalo de nuevo.',
            variant: 'destructive',
        });
        setIsLoading(false);
        return;
    }


    // Simular el procesamiento del pedido
    setTimeout(() => {
      clearCart();
      setIsLoading(false);
      // Pequeño delay para asegurar que sessionStorage se escriba antes de redirigir
      setTimeout(() => router.push('/checkout/success'), 50);
    }, 1000);
  };
  
  // Redirigir si el carrito está vacío al cargar la página
  React.useEffect(() => {
    // This effect runs only on mount.
    // If the cart is empty when the user lands on this page, redirect them.
    if (cart.length === 0) {
      router.replace('/items');
    }
  }, [cart, router]);

  if (cart.length === 0) {
    // Show a loading spinner while redirecting.
    // This prevents the user from seeing a flash of an empty checkout page.
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[calc(100vh-200px)]">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Columna Izquierda: Formulario */}
            <div className="lg:col-span-2 space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Información de Envío</CardTitle>
                  <CardDescription>Completa tus datos para la entrega del pedido.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={methods.control}
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
                    control={methods.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección de Envío</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Calle Falsa 123, Springfield" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={methods.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="Ej: +54 9 11 12345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={methods.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Correo Electrónico</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Ej: juan.perez@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                   <FormField
                    control={methods.control}
                    name="saveInfo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 mt-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Guardar mi información para futuras compras
                          </FormLabel>
                          <FormDescription>
                            Tus datos de envío se guardarán en este navegador.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Forma de Pago</CardTitle>
                  <CardDescription>Selecciona cómo quieres pagar tu pedido.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={methods.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="space-y-3"
                          >
                            <Label className="flex items-center gap-4 rounded-md border p-4 cursor-pointer hover:bg-accent has-[:checked]:bg-accent has-[:checked]:border-primary">
                              <RadioGroupItem value="transfer" />
                              <Landmark className="h-6 w-6 text-muted-foreground" />
                              <div className='flex flex-col'>
                                <span className='font-semibold'>Transferencia Bancaria</span>
                                <span className='text-xs text-muted-foreground'>Paga directamente desde tu cuenta bancaria.</span>
                              </div>
                            </Label>
                            <Label className="flex items-center gap-4 rounded-md border p-4 cursor-pointer hover:bg-accent has-[:checked]:bg-accent has-[:checked]:border-primary">
                              <RadioGroupItem value="cash" />
                              <Wallet className="h-6 w-6 text-muted-foreground" />
                               <div className='flex flex-col'>
                                <span className='font-semibold'>Pago en Efectivo</span>
                                <span className='text-xs text-muted-foreground'>Paga al momento de recibir tu pedido.</span>
                              </div>
                            </Label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="pt-4" />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Columna Derecha: Resumen del Pedido */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Resumen del Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-[250px] pr-4">
                    <div className="space-y-4">
                        {cart.map(item => (
                        <div key={item.id} className="flex items-center gap-4">
                          <div className="relative h-16 w-16 rounded-md overflow-hidden border">
                             <Image
                                src={item.imageUrl || `https://placehold.co/100x100.png`}
                                alt={item.name}
                                fill
                                className="object-cover"
                                data-ai-hint="product photo"
                              />
                              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                                {item.quantity}
                              </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                          </div>
                          <p className="text-sm font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? 'Procesando Pedido...' : `Pagar $${total.toFixed(2)}`}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
