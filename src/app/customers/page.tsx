
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Users } from 'lucide-react';

// Explicitly type the customer data fetched from Firestore
interface CustomerFromDB extends Omit<Customer, 'createdAt' | 'lastOrderDate'> {
  createdAt: Timestamp;
  lastOrderDate: Timestamp;
}

export default function CustomersPage() {

  const { data: customers, isLoading, error } = useQuery<CustomerFromDB[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const customersCollection = collection(db, 'customers');
      const q = query(customersCollection, orderBy('lastOrderDate', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as CustomerFromDB);
    },
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>Aquí puedes ver todos los clientes que han realizado una compra.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                  <TableHead className="text-right">Última Compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-destructive">
                      <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Error al cargar los clientes.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && customers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                       <div className="flex flex-col items-center justify-center gap-2">
                         <Users className="h-8 w-8 text-muted-foreground" />
                         <p className="font-medium">No hay clientes todavía.</p>
                         <p className="text-sm text-muted-foreground">Los clientes aparecerán aquí después de su primera compra.</p>
                       </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && customers?.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{customer.email}</TableCell>
                    <TableCell className="hidden md:table-cell">{customer.phone}</TableCell>
                    <TableCell className="text-right">
                        {customer.lastOrderDate ? new Date(customer.lastOrderDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </TableCell>
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
