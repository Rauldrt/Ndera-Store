
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ShoppingCart, Eye, Trash2, Download, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Explicitly type the order data fetched from Firestore
interface OrderFromDB extends Omit<Order, 'createdAt'> {
  id: string; // Ensure id is present
  createdAt: Timestamp;
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<OrderFromDB | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const { data: orders, isLoading, error } = useQuery<OrderFromDB[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const ordersCollection = collection(db, 'orders');
      const q = query(ordersCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderFromDB));
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await deleteDoc(doc(db, 'orders', orderId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Pedido Eliminado', description: 'El pedido ha sido eliminado del historial.' });
      setShowDeleteDialog(false);
      setOrderToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: `No se pudo eliminar el pedido: ${(error as Error).message}`, variant: 'destructive' });
      setShowDeleteDialog(false);
      setOrderToDelete(null);
    },
  });

  const handleDeleteClick = (orderId: string) => {
    setOrderToDelete(orderId);
    setShowDeleteDialog(true);
  };

  const generateOrderPDF = (order: OrderFromDB) => {
    const doc = new jsPDF();
    const { customerInfo, items, total, createdAt, paymentMethod } = order;

    // Add logo
    const logoImg = document.getElementById('app-logo') as HTMLImageElement;
    if (logoImg) {
        doc.addImage(logoImg, 'PNG', 14, 15, 40, 15);
    }

    doc.setFontSize(22);
    doc.text('Comprobante de Pedido', 105, 25, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Información del Cliente:', 14, 45);
    doc.setFontSize(10);
    doc.text(`Nombre: ${customerInfo.name}`, 14, 53);
    doc.text(`Email: ${customerInfo.email}`, 14, 59);

    doc.setFontSize(12);
    doc.text('Detalles del Pedido:', 105, 45);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date(createdAt.seconds * 1000).toLocaleDateString()}`, 105, 53);
    doc.text(`Total: $${total.toFixed(2)}`, 105, 59);
    const paymentMethodText = getPaymentMethodText(paymentMethod);
    doc.text(`Método de Pago: ${paymentMethodText}`, 105, 65);

    const tableColumn = ["Producto", "Cantidad", "Precio Unitario", "Subtotal"];
    const tableRows = items.map(item => [
      item.name,
      item.quantity,
      `$${item.price.toFixed(2)}`,
      `$${(item.price * item.quantity).toFixed(2)}`
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
    doc.text('¡Gracias por la compra!', 105, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    doc.save(`comprobante-pedido-${order.id}.pdf`);
  };

  const getPaymentMethodVariant = (method: string): 'default' | 'secondary' => {
    switch (method) {
      case 'transfer': return 'default';
      case 'cash': return 'secondary';
      default: return 'default';
    }
  }

  const getPaymentMethodText = (method: string): string => {
    switch (method) {
      case 'transfer': return 'Transferencia';
      case 'cash': return 'Efectivo';
      default: return 'Desconocido';
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Todos los Pedidos</CardTitle>
          <CardDescription>Aquí puedes ver el historial completo de pedidos y realizar acciones.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell w-[150px]">Forma de Pago</TableHead>
                  <TableHead className="hidden md:table-cell text-right w-[120px]">Total</TableHead>
                  <TableHead className="text-right w-[200px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell className="hidden md:table-cell text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-40 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-destructive">
                      <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Error al cargar los pedidos.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && orders?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                        <p className="font-medium">No hay pedidos todavía.</p>
                        <p className="text-sm text-muted-foreground">Los nuevos pedidos aparecerán aquí.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && orders?.map(order => (
                  <TableRow key={order.id}>
                    <TableCell>
                      {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customerInfo.name}</div>
                      <div className="text-xs text-muted-foreground">{order.customerInfo.email}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={getPaymentMethodVariant(order.paymentMethod)}>
                        {getPaymentMethodText(order.paymentMethod)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right font-semibold">${order.total.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                         <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(order)} title="Ver Detalles">
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver Detalles</span>
                         </Button>
                         <Button variant="ghost" size="icon" onClick={() => generateOrderPDF(order)} title="Descargar PDF">
                            <Download className="h-4 w-4" />
                            <span className="sr-only">Descargar PDF</span>
                         </Button>
                         <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(order.id)} title="Eliminar Pedido">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar Pedido</span>
                         </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Pedido</DialogTitle>
            <DialogDescription>
              Realizado por {selectedOrder?.customerInfo.name} el {selectedOrder ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleDateString() : ''}.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">Cliente</h4>
                  <p>{selectedOrder.customerInfo.name}</p>
                  <p className="text-muted-foreground">{selectedOrder.customerInfo.email}</p>
                </div>
                 <div>
                  <h4 className="font-semibold mb-1">Información General</h4>
                   <p>Método de Pago: <Badge variant={getPaymentMethodVariant(selectedOrder.paymentMethod)} className="ml-1">{getPaymentMethodText(selectedOrder.paymentMethod)}</Badge></p>
                   <p>Total: <span className="font-bold">${selectedOrder.total.toFixed(2)}</span></p>
                </div>
              </div>
              <Separator />
               <div>
                 <h4 className="font-semibold mb-2">Productos Comprados</h4>
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Producto</TableHead>
                       <TableHead className="text-center w-[80px]">Cant.</TableHead>
                       <TableHead className="text-right w-[120px]">Precio Unit.</TableHead>
                       <TableHead className="text-right w-[120px]">Subtotal</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {selectedOrder.items.map(item => (
                       <TableRow key={item.id}>
                         <TableCell className="font-medium">{item.name}</TableCell>
                         <TableCell className="text-center">{item.quantity}</TableCell>
                         <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                         <TableCell className="text-right">${(item.price * item.quantity).toFixed(2)}</TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pedido será eliminado permanentemente del historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orderToDelete) deleteOrderMutation.mutate(orderToDelete);
              }}
              disabled={deleteOrderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOrderMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );

    
