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
import { Loader2, CreditCard, Landmark, Wallet, LocateFixed } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';


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
  const [geolocation, setGeolocation] = React.useState<{ latitude: number, longitude: number } | null>(null);
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
        if (savedInfo.geolocation) {
          setGeolocation(savedInfo.geolocation);
        }
      }
    } catch (error) {
      console.error("Error al cargar la información de envío guardada:", error);
    }
  }, [methods]);

  const handleGetGeolocation = () => {
    if (navigator.geolocation) {
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
        },
        (error) => {
          toast({
            title: "Error de Ubicación",
            description: "No se pudo obtener tu ubicación. Asegúrate de haber concedido los permisos.",
            variant: "destructive",
          });
          console.error("Error al obtener geolocalización:", error);
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
  

  const onSubmit = async (data: CheckoutFormValues) => {
    setIsLoading(true);

    if (data.saveInfo) {
      const shippingInfoToSave = {
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        geolocation: geolocation,
      };
      try {
        localStorage.setItem(SAVED_SHIPPING_INFO_KEY, JSON.stringify(shippingInfoToSave));
      } catch (error) {
        console.error("Error al guardar la información de envío:", error);
      }
    } else {
      localStorage.removeItem(SAVED_SHIPPING_INFO_KEY);
    }

    try {
        // Save or update customer
        const customersRef = collection(db, 'customers');
        const q = query(customersRef, where("email", "==", data.email));
        const querySnapshot = await getDocs(q);
        let customerId: string;

        const customerData: any = {
            name: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            lastOrderDate: serverTimestamp(),
        };

        if (geolocation) {
          customerData.geolocation = geolocation;
        }

        if (querySnapshot.empty) {
            // New customer
            const customerDocRef = await addDoc(customersRef, {
                ...customerData,
                createdAt: serverTimestamp(),
            });
            customerId = customerDocRef.id;
        } else {
            // Existing customer, update their info
            const customerDocRef = doc(db, 'customers', querySnapshot.docs[0].id);
            await updateDoc(customerDocRef, customerData);
            customerId = customerDocRef.id;
        }

        // Create the order
        const ordersRef = collection(db, 'orders');
        await addDoc(ordersRef, {
            customerId: customerId,
            customerInfo: { // Denormalized for easy access in order lists
                name: data.name,
                email: data.email,
            },
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
            })),
            total: total,
            paymentMethod: data.paymentMethod,
            createdAt: serverTimestamp(),
        });


        // Store order details for success page
        const orderDetails = {
          shipping: {
            name: data.name,
            address: data.address,
            phone: data.phone,
            email: data.email,
            geolocation: geolocation, // Add geolocation here
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

        sessionStorage.setItem(ORDER_DETAILS_KEY, JSON.stringify(orderDetails));

        // Clear cart and redirect
        clearCart();
        router.push('/checkout/success');

    } catch (error) {
        console.error("Error al procesar el pedido o guardar cliente:", error);
        toast({
            title: 'Error Inesperado',
            description: 'No se pudo procesar el pedido. Por favor, inténtalo de nuevo.',
            variant: 'destructive',
        });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (cart.length === 0 && !isLoading) {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[calc(100vh-200px)]">
            <div className="text-center">
                 <p className="mt-4 text-muted-foreground">Cargando...</p>
            </div>
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
                  <div className="space-y-2">
                    <Label>Dirección de Envío</Label>
                    <FormField
                      control={methods.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="!mt-0">
                          <FormControl>
                            <Input placeholder="Ej: Calle Falsa 123, Springfield" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <Button type="button" variant="outline" size="sm" onClick={handleGetGeolocation}>
                      <LocateFixed className="mr-2 h-4 w-4" />
                      Obtener Ubicación Actual
                    </Button>
                    {geolocation && (
                      <p className="text-xs text-muted-foreground">
                        Ubicación guardada: {geolocation.latitude.toFixed(4)}, {geolocation.longitude.toFixed(4)}
                      </p>
                    )}
                  </div>
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
                  <FormField
                    control={methods.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="font-semibold text-base">Forma de Pago</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-4"
                          >
                            <Label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-accent has-[:checked]:border-primary transition-all">
                              <RadioGroupItem value="transfer" className="sr-only" />
                              <Landmark className="h-6 w-6 text-muted-foreground" />
                              <span className='font-medium text-sm text-center'>Transferencia</span>
                            </Label>
                            <Label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-3 cursor-pointer hover:bg-accent has-[:checked]:bg-accent has-[:checked]:border-primary transition-all">
                              <RadioGroupItem value="cash" className="sr-only" />
                              <Wallet className="h-6 w-6 text-muted-foreground" />
                              <span className='font-medium text-sm text-center'>Efectivo</span>
                            </Label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="pt-2 text-center" />
                      </FormItem>
                    )}
                  />
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
