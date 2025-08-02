
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Download, ShoppingBag, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Link from 'next/link';
import { useCart } from '@/context/cart-context';

interface OrderDetails {
  shipping: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  paymentMethod: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  total: number;
  orderDate: string;
}

const ORDER_DETAILS_KEY = 'orderDetails';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const { clearCart } = useCart(); // Get clearCart to ensure it's empty

  useEffect(() => {
    try {
      const savedDetailsRaw = sessionStorage.getItem(ORDER_DETAILS_KEY);
      if (savedDetailsRaw) {
        const savedDetails = JSON.parse(savedDetailsRaw);
        setOrderDetails(savedDetails);
        // Clear the session storage after retrieving the data
        sessionStorage.removeItem(ORDER_DETAILS_KEY);
        // Ensure the main cart state is also cleared
        clearCart();
      } else {
        // If no order details are found, redirect to the main page
        router.replace('/items');
      }
    } catch (error) {
      console.error("Error al cargar los detalles del pedido:", error);
      router.replace('/items');
    }
  }, [router, clearCart]);

  const generatePDF = () => {
    if (!orderDetails) return;

    const doc = new jsPDF();
    const { shipping, items, total, orderDate, paymentMethod } = orderDetails;

    // Título
    doc.setFontSize(22);
    doc.text('Comprobante de Pedido', 105, 20, { align: 'center' });

    // Información del Cliente y Pedido
    doc.setFontSize(12);
    doc.text('Información del Cliente:', 14, 40);
    doc.setFontSize(10);
    doc.text(`Nombre: ${shipping.name}`, 14, 48);
    doc.text(`Dirección: ${shipping.address}`, 14, 54);
    doc.text(`Email: ${shipping.email}`, 14, 60);
    doc.text(`Teléfono: ${shipping.phone}`, 14, 66);
    
    doc.setFontSize(12);
    doc.text('Detalles del Pedido:', 105, 40);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date(orderDate).toLocaleDateString()}`, 105, 48);
    doc.text(`Total: $${total.toFixed(2)}`, 105, 54);
    const paymentMethodText = paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Efectivo';
    doc.text(`Método de Pago: ${paymentMethodText}`, 105, 60);


    // Tabla de Productos
    const tableColumn = ["Producto", "Cantidad", "Precio Unitario", "Subtotal"];
    const tableRows = items.map(item => [
      item.name,
      item.quantity,
      `$${item.price.toFixed(2)}`,
      `$${item.total.toFixed(2)}`
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 75,
      headStyles: { fillColor: [22, 163, 74] },
      styles: { halign: 'center' },
      columnStyles: { 0: { halign: 'left' } }
    });
    
    // Total
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(14);
    doc.text(`Total del Pedido: $${total.toFixed(2)}`, 14, finalY + 15);


    // Pie de página
    doc.setFontSize(10);
    doc.text('¡Gracias por tu compra!', 105, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    doc.save(`comprobante-pedido-${new Date().getTime()}.pdf`);
  };

  if (!orderDetails) {
    // Muestra un estado de carga mientras se verifica sessionStorage
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <div className="text-center">
          <p>Cargando confirmación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-180px)] w-full bg-muted/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl text-center shadow-lg">
        <CardHeader className="items-center">
          <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
          <CardTitle className="text-3xl">¡Gracias por tu compra!</CardTitle>
          <CardDescription>Tu pedido ha sido realizado con éxito.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />
          <div className="text-left space-y-4">
            <h3 className="font-semibold text-lg">Resumen del Pedido</h3>
            <div className="space-y-2">
              {orderDetails.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <p className="text-muted-foreground">{item.name} (x{item.quantity})</p>
                  <p className="font-medium">${item.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-xl">
              <p>Total</p>
              <p>${orderDetails.total.toFixed(2)}</p>
            </div>
          </div>
           <div className="text-left p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-2">Enviado a:</h4>
                <p className="text-sm text-muted-foreground">{orderDetails.shipping.name}</p>
                <p className="text-sm text-muted-foreground">{orderDetails.shipping.address}</p>
                <p className="text-sm text-muted-foreground">{orderDetails.shipping.email}</p>
            </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button onClick={generatePDF} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Descargar Comprobante
            </Button>
            <Link href="/items">
                <Button variant="outline" className="w-full sm:w-auto">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Seguir Comprando
                </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
