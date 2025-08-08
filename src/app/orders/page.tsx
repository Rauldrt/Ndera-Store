
'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, Timestamp, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, Customer } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ShoppingCart, Eye, Trash2, Download, Loader2, MoreVertical, FileText, FileUp, Truck } from 'lucide-react';
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
import Papa from 'papaparse';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"

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
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);


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
    },
    onError: (error) => {
      toast({ title: 'Error', description: `No se pudo eliminar el pedido: ${(error as Error).message}`, variant: 'destructive' });
    },
    onSettled: () => {
        setShowDeleteDialog(false);
        setOrderToDelete(null);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.delete(doc(db, 'orders', id));
      });
      await batch.commit();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Pedidos Eliminados', description: `${variables.length} pedidos han sido eliminados.` });
    },
    onError: (error) => {
      toast({ title: 'Error en la Eliminación Múltiple', description: `No se pudieron eliminar los pedidos: ${(error as Error).message}`, variant: 'destructive' });
    },
    onSettled: () => {
      setSelectedRowIds([]);
    }
  });


  const handleDeleteClick = (orderId: string) => {
    setOrderToDelete(orderId);
    setShowDeleteDialog(true);
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
      case 'saved': return 'Guardado';
      default: return 'Desconocido';
    }
  }

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

  const handleBulkExportCSV = () => {
    if (!orders || selectedRowIds.length === 0) {
      toast({ title: "No hay pedidos seleccionados para exportar." });
      return;
    }

    const selectedOrders = orders.filter(o => selectedRowIds.includes(o.id));
    
    // Flatten data: one row per item in an order
    const flattenedData = selectedOrders.flatMap(order => 
      order.items.map(item => ({
        'ID Pedido': order.id,
        'Fecha Pedido': new Date(order.createdAt.seconds * 1000).toISOString(),
        'Cliente Nombre': order.customerInfo.name,
        'Cliente Email': order.customerInfo.email,
        'ID Producto': item.id,
        'Producto Nombre': item.name,
        'Cantidad': item.quantity,
        'Precio Unitario': item.price,
        'Subtotal Producto': item.price * item.quantity,
        'Total Pedido': order.total,
        'Metodo de Pago': getPaymentMethodText(order.paymentMethod),
      }))
    );

    if (flattenedData.length === 0) {
      toast({ title: "Los pedidos seleccionados no tienen productos." });
      return;
    }

    const csv = Papa.unparse(flattenedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `pedidos_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportación a CSV iniciada." });
  };
  
  const handleBulkExportPDF = () => {
    if (!orders || selectedRowIds.length === 0) {
      toast({ title: "No hay pedidos seleccionados para exportar." });
      return;
    }

    const selectedOrders = orders.filter(o => selectedRowIds.includes(o.id));
    const doc = new jsPDF();
    const logoImg = document.getElementById('app-logo') as HTMLImageElement;

    selectedOrders.forEach((order, index) => {
      if (index > 0) {
        doc.addPage();
      }

      if (logoImg) {
        doc.addImage(logoImg, 'PNG', 14, 15, 40, 15);
      }
      doc.setFontSize(20);
      doc.text(`Comprobante Pedido: ${order.id}`, 105, 25, { align: 'center' });

      doc.setFontSize(10);
      doc.text(`Fecha: ${new Date(order.createdAt.seconds * 1000).toLocaleDateString()}`, 14, 45);
      doc.text(`Cliente: ${order.customerInfo.name} (${order.customerInfo.email})`, 14, 51);
      doc.text(`Método de Pago: ${getPaymentMethodText(order.paymentMethod)}`, 14, 57);

      const tableColumn = ["Producto", "Cantidad", "Precio Unit.", "Subtotal"];
      const tableRows = order.items.map(item => [
        item.name,
        item.quantity,
        `$${item.price.toFixed(2)}`,
        `$${(item.price * item.quantity).toFixed(2)}`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        headStyles: { fillColor: [22, 163, 74] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 65;
      doc.setFontSize(12);
      doc.text(`Total del Pedido: $${order.total.toFixed(2)}`, 14, finalY + 10);
    });

    doc.save(`pedidos_export_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: "Exportación a PDF iniciada." });
  };

  const handleCreateDeliveryRoute = async () => {
    if (!orders || selectedRowIds.length === 0) {
        toast({ title: "Selecciona pedidos para crear un reparto." });
        return;
    }

    toast({ title: "Generando hoja de reparto...", description: "Esto puede tardar unos segundos." });

    try {
        const selectedOrders = orders.filter(o => selectedRowIds.includes(o.id));

        // Fetch full customer data for selected orders
        const customerDataPromises = selectedOrders.map(async (order) => {
            if (!order.customerId) return null;
            const customerRef = doc(db, 'customers', order.customerId);
            const customerSnap = await getDoc(customerRef);
            return customerSnap.exists() ? { orderId: order.id, customer: customerSnap.data() as Customer } : null;
        });

        const customerResults = await Promise.all(customerDataPromises);
        const customersMap = new Map(customerResults.filter(Boolean).map(res => [res!.orderId, res!.customer]));
        
        // 1. Consolidate all products
        const productSummary: { [key: string]: { name: string, quantity: number } } = {};
        selectedOrders.forEach(order => {
            order.items.forEach(item => {
                if (productSummary[item.id]) {
                    productSummary[item.id].quantity += item.quantity;
                } else {
                    productSummary[item.id] = { name: item.name, quantity: item.quantity };
                }
            });
        });

        const doc = new jsPDF();
        const logoImg = document.getElementById('app-logo') as HTMLImageElement;
        let finalY = 10;

        // --- PDF Header ---
        if (logoImg) doc.addImage(logoImg, 'PNG', 14, 15, 40, 15);
        doc.setFontSize(22);
        doc.text('Hoja de Reparto', 105, 25, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 40);
        doc.text(`Total de Paradas: ${selectedOrders.length}`, 105, 40);
        finalY = 45;

        // --- Product Summary Table ---
        doc.setFontSize(16);
        doc.text('Resumen de Carga', 14, finalY + 10);
        autoTable(doc, {
            head: [['Producto', 'Cantidad Total']],
            body: Object.values(productSummary).map(p => [p.name, p.quantity]),
            startY: finalY + 15,
            headStyles: { fillColor: [59, 130, 246] },
        });
        finalY = (doc as any).lastAutoTable.finalY;

        // --- Delivery Stops ---
        doc.setFontSize(16);
        doc.text('Paradas de Entrega', 14, finalY + 15);
        finalY += 20;

        selectedOrders.forEach((order, index) => {
            const customer = customersMap.get(order.id);
            if (index > 0) {
                 finalY += 5;
                 doc.line(14, finalY, 196, finalY); // Separator line
                 finalY += 10;
            }
            if (finalY > 260) { // Manual page break
                doc.addPage();
                finalY = 20;
            }

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Parada ${index + 1}: ${order.customerInfo.name}`, 14, finalY);
            doc.setFont(undefined, 'normal');

            finalY += 6;
            let addressText = customer?.address || 'Dirección no disponible';
            doc.text(`Dirección: ${addressText}`, 14, finalY);
            if (customer?.geolocation) {
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${customer.geolocation.latitude},${customer.geolocation.longitude}`;
                doc.setTextColor(6, 69, 173); // Blue link color
                doc.textWithLink('Ver en Mapa', 14, finalY + 6, { url: mapsUrl });
                doc.setTextColor(0, 0, 0);
                finalY += 6;
            }

            finalY += 6;
            doc.text(`Teléfono: ${customer?.phone || 'No disponible'}`, 14, finalY);

            autoTable(doc, {
                head: [['Producto', 'Cantidad', 'Precio']],
                body: order.items.map(item => [item.name, item.quantity, `$${item.price.toFixed(2)}`]),
                startY: finalY + 5,
                theme: 'striped',
                headStyles: { fillColor: [100, 116, 139] },
            });
            finalY = (doc as any).lastAutoTable.finalY;

            doc.setFont(undefined, 'bold');
            doc.text(`Total: $${order.total.toFixed(2)}`, 14, finalY + 8);
            doc.text(`Pago: ${getPaymentMethodText(order.paymentMethod)}`, 105, finalY + 8);
        });

        doc.save(`hoja_reparto_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (e) {
        console.error("Error creating delivery route PDF:", e);
        toast({ title: "Error al generar el PDF", description: "No se pudo crear la hoja de reparto.", variant: "destructive" });
    }
  }


  const numSelected = selectedRowIds.length;
  const rowCount = orders?.length ?? 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Todos los Pedidos</CardTitle>
          <CardDescription>Aquí puedes ver el historial completo de pedidos y realizar acciones.</CardDescription>
        </CardHeader>
        <CardContent>
          {numSelected > 0 && (
            <div className="mb-4 flex items-center gap-4 rounded-md bg-muted p-3">
              <p className="text-sm font-medium text-muted-foreground flex-grow">
                {numSelected} de {rowCount} fila(s) seleccionadas.
              </p>
               <Button variant="outline" size="sm" onClick={handleCreateDeliveryRoute}>
                    <Truck className="mr-2 h-4 w-4" />
                    Crear Reparto
                </Button>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                       <FileUp className="mr-2 h-4 w-4" />
                       Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleBulkExportCSV}>
                        <FileText className="mr-2 h-4 w-4" />
                        Exportar a CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkExportPDF}>
                        <Download className="mr-2 h-4 w-4" />
                        Exportar a PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => bulkDeleteMutation.mutate(selectedRowIds)}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Eliminar
              </Button>
            </div>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                     <Checkbox
                        checked={numSelected === rowCount && rowCount > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRowIds(orders?.map(o => o.id) ?? []);
                          } else {
                            setSelectedRowIds([]);
                          }
                        }}
                        aria-label="Seleccionar todo"
                        data-state={numSelected > 0 && numSelected < rowCount ? 'indeterminate' : undefined}
                      />
                  </TableHead>
                  <TableHead className="w-[120px]">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell w-[150px]">Forma de Pago</TableHead>
                  <TableHead className="hidden md:table-cell text-right w-[120px]">Total</TableHead>
                  <TableHead className="text-right w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell className="hidden md:table-cell text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-destructive">
                      <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Error al cargar los pedidos.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && orders?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                        <p className="font-medium">No hay pedidos todavía.</p>
                        <p className="text-sm text-muted-foreground">Los nuevos pedidos aparecerán aquí.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && orders?.map(order => (
                  <TableRow 
                    key={order.id}
                    data-state={selectedRowIds.includes(order.id) && "selected"}
                  >
                    <TableCell>
                      <Checkbox
                          checked={selectedRowIds.includes(order.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                                setSelectedRowIds([...selectedRowIds, order.id]);
                            } else {
                                setSelectedRowIds(selectedRowIds.filter(id => id !== order.id));
                            }
                          }}
                          aria-label="Seleccionar fila"
                        />
                    </TableCell>
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
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                               <Eye className="mr-2 h-4 w-4" />
                               Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateOrderPDF(order)}>
                               <Download className="mr-2 h-4 w-4" />
                               Descargar PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(order.id)}>
                               <Trash2 className="mr-2 h-4 w-4" />
                               Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
    


    

    
