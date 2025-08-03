
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ShoppingCart } from 'lucide-react';

// Explicitly type the order data fetched from Firestore
interface OrderFromDB extends Omit<Order, 'createdAt'> {
  id: string; // Ensure id is present
  createdAt: Timestamp;
}

export default function OrdersPage() {

  const { data: orders, isLoading, error } = useQuery<OrderFromDB[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const ordersCollection = collection(db, 'orders');
      const q = query(ordersCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderFromDB));
    },
  });

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
          <CardDescription>Aquí puedes ver el historial completo de pedidos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Forma de Pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-destructive">
                      <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Error al cargar los pedidos.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && orders?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
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
                    <TableCell className="text-right font-semibold">${order.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
