
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, Timestamp, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Users, PlusCircle, Edit, Trash2, Loader2, MapPin } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { CustomerForm, type CustomerFormValues } from '@/components/customer/customer-form';

interface CustomerFromDB extends Omit<Customer, 'createdAt' | 'lastOrderDate'> {
  id: string;
  createdAt: Timestamp;
  lastOrderDate: Timestamp;
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerFromDB | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  const { data: customers, isLoading, error } = useQuery<CustomerFromDB[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const customersCollection = collection(db, 'customers');
      const q = query(customersCollection, orderBy('lastOrderDate', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerFromDB));
    },
  });

  const addCustomerMutation = useMutation({
    mutationFn: async (customerData: CustomerFormValues) => {
      const docRef = await addDoc(collection(db, 'customers'), {
        ...customerData,
        createdAt: serverTimestamp(),
        lastOrderDate: serverTimestamp(), // Set initial last order date
      });
      return docRef;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente Añadido', description: 'El nuevo cliente ha sido guardado.' });
      setIsFormOpen(false);
      setEditingCustomer(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: `No se pudo añadir el cliente: ${(error as Error).message}`, variant: 'destructive' });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: CustomerFormValues }) => {
      const customerRef = doc(db, 'customers', id);
      await updateDoc(customerRef, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente Actualizado', description: 'Los datos del cliente han sido guardados.' });
      setIsFormOpen(false);
      setEditingCustomer(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: `No se pudo actualizar el cliente: ${(error as Error).message}`, variant: 'destructive' });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      // Note: This does not delete associated orders for history integrity.
      await deleteDoc(doc(db, 'customers', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente Eliminado', description: 'El cliente ha sido eliminado.' });
      setShowDeleteDialog(false);
      setCustomerToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: `No se pudo eliminar el cliente: ${(error as Error).message}`, variant: 'destructive' });
      setShowDeleteDialog(false);
      setCustomerToDelete(null);
    },
  });

  const handleFormSubmit = async (data: CustomerFormValues) => {
    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, data });
    } else {
      addCustomerMutation.mutate(data);
    }
  };

  const handleEditClick = (customer: CustomerFromDB) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setCustomerToDelete(id);
    setShowDeleteDialog(true);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>Aquí puedes ver y gestionar todos los clientes.</CardDescription>
          </div>
          <Button onClick={() => { setEditingCustomer(null); setIsFormOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Cliente
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Ubicación</TableHead>
                  <TableHead className="hidden lg:table-cell">Última Compra</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-destructive">
                      <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Error al cargar los clientes.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && customers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <p className="font-medium">No hay clientes todavía.</p>
                        <p className="text-sm text-muted-foreground">Añade un cliente o espera a la primera compra.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && customers?.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{customer.email}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {customer.geolocation ? (
                         <a
                          href={`https://www.google.com/maps/search/?api=1&query=${customer.geolocation.latitude},${customer.geolocation.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <MapPin className="h-4 w-4" />
                          Ver en Mapa
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No disponible</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {customer.lastOrderDate ? new Date(customer.lastOrderDate.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(customer)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(customer.id)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar</span>
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? 'Actualiza los datos del cliente.' : 'Rellena los campos para crear un nuevo cliente.'}
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            onSubmit={handleFormSubmit}
            initialData={editingCustomer || undefined}
            isLoading={addCustomerMutation.isPending || updateCustomerMutation.isPending}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El cliente será eliminado, pero sus pedidos permanecerán en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (customerToDelete) deleteCustomerMutation.mutate(customerToDelete);
              }}
              disabled={deleteCustomerMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCustomerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

