
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Download, ShoppingBag, ArrowLeft, Home } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

interface OrderDetails {
  shipping: {
    name: string;
    address: string;
    phone: string;
    email: string;
    geolocation?: {
        latitude: number;
        longitude: number;
    }
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
const LAST_VISITED_CATALOG_KEY = 'lastVisitedCatalogId';


// Simple component for WhatsApp icon
const WhatsAppIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="mr-2"
    >
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.447-4.435-9.884-9.888-9.884-5.448 0-9.886 4.434-9.889 9.884-.001 2.225.651 4.315 1.919 6.066l-1.225 4.485 4.574-1.21zm3.807-6.393c-.277-.138-1.644-.813-1.9-1.018-.255-.205-.44-.347-.614.138-.173.484-.657 1.599-.803 1.845-.145.246-.29.277-.544.138-.254-.138-1.063-.393-2.025-1.25-.748-.657-1.25-1.475-1.412-1.721-.161-.246-.022-.38.114-.51.124-.118.277-.304.415-.45.138-.145.184-.246.277-.414.093-.168.046-.309-.023-.447-.07-.138-.614-1.475-.851-2.012-.23-.532-.47-.458-.644-.465-.161-.007-.347-.007-.521-.007-.173 0-.44.068-.665.347-.225.277-.851.84-.851 2.052s.874 2.378 1.002 2.545c.128.168 1.708 2.572 4.148 3.645.589.255 1.052.408 1.412.521.564.178 1.074.145 1.48.093.447-.053 1.645-.674 1.88-1.314.23-.64.23-.119.16-.247-.07-.127-.255-.204-.521-.34z" />
    </svg>
);


export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [backUrl, setBackUrl] = useState('/items');
  const [isCatalogContext, setIsCatalogContext] = useState(false);

  useEffect(() => {
    try {
      const savedDetailsRaw = sessionStorage.getItem(ORDER_DETAILS_KEY);
      if (savedDetailsRaw) {
        const savedDetails = JSON.parse(savedDetailsRaw);
        setOrderDetails(savedDetails);
      } else {
        router.replace('/items');
      }

      const lastCatalogId = localStorage.getItem(LAST_VISITED_CATALOG_KEY);
      if (lastCatalogId) {
          setBackUrl(`/catalog/${lastCatalogId}`);
          setIsCatalogContext(true);
      } else {
          setBackUrl('/items');
          setIsCatalogContext(false);
      }

    } catch (error) {
      console.error("Error al cargar los detalles del pedido:", error);
      router.replace('/items');
    }
  }, [router]);

  const generatePDF = () => {
    if (!orderDetails) return;

    const doc = new jsPDF();
    const { shipping, items, total, orderDate, paymentMethod } = orderDetails;

    doc.setFontSize(22);
    doc.text('Comprobante de Pedido', 105, 20, { align: 'center' });

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


    const tableColumn = ["Producto", "Cantidad", "Precio Unitario", "Subtotal"];
    const tableRows = items.map(item => [
      item.name,
      item.quantity,
      `$${item.price.toFixed(2)}`,
      `$${item.total.toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 75,
      headStyles: { fillColor: [22, 163, 74] },
      styles: { halign: 'center' },
      columnStyles: { 0: { halign: 'left' } }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY || 75;
    doc.setFontSize(14);
    doc.text(`Total del Pedido: $${total.toFixed(2)}`, 14, finalY + 15);


    doc.setFontSize(10);
    doc.text('¡Gracias por tu compra!', 105, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    doc.save(`comprobante-pedido-${new Date().getTime()}.pdf`);
  };
  
  const sendByWhatsApp = () => {
    if (!orderDetails) return;
    
    const { shipping, items, total, orderDate, paymentMethod } = orderDetails;
    const paymentMethodText = paymentMethod === 'transfer' ? 'Transferencia Bancaria' : 'Efectivo';

    let message = `¡Hola! Aquí está el resumen de mi pedido:\n\n`;
    message += `*Cliente:* ${shipping.name}\n`;
    message += `*Dirección:* ${shipping.address}\n`;
    if (shipping.geolocation) {
        const { latitude, longitude } = shipping.geolocation;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        message += `*Ubicación:* ${mapsUrl}\n`;
    }
    message += `*Fecha:* ${new Date(orderDate).toLocaleDateString()}\n`;
    message += `*Método de Pago:* ${paymentMethodText}\n`;
    message += `------------------------\n\n`;
    message += `*Productos:*\n`;

    items.forEach(item => {
      message += `• ${item.name} (x${item.quantity}) - $${item.total.toFixed(2)}\n`;
    });

    message += `\n------------------------\n`;
    message += `*Total del Pedido: $${total.toFixed(2)}*\n\n`;
    message += `¡Gracias!`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };


  if (!orderDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-primary animate-spin" />
          <p className="mt-4">Cargando confirmación...</p>
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
                 {orderDetails.shipping.geolocation && (
                    <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${orderDetails.shipping.geolocation.latitude},${orderDetails.shipping.geolocation.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                    >
                        Ver ubicación en el mapa
                    </a>
                )}
            </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button onClick={generatePDF} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Descargar Comprobante
            </Button>
            <Button onClick={sendByWhatsApp} className="w-full sm:w-auto" variant="secondary">
                <WhatsAppIcon />
                Enviar por WhatsApp
            </Button>
          </div>
          <div className="mt-4">
             <Link href={backUrl}>
                <Button variant="outline" className="w-full sm:w-auto">
                    {isCatalogContext ? (
                        <>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Volver al Catálogo
                        </>
                    ) : (
                        <>
                           <ShoppingBag className="mr-2 h-4 w-4" />
                            Ver todos los Productos
                        </>
                    )}
                </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
