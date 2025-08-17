
'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, orderBy, getDocs, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Users, Trash2, Loader2, MoreVertical, ShieldCheck, UserCog, Info } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

// Extending AppUser to include what we get from Firestore
interface UserFromDB extends AppUser {
  id: string; // The doc ID
  createdAt?: Timestamp;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserFromDB | null>(null);

  const { data: users, isLoading, error } = useQuery<UserFromDB[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const usersCollection = collection(db, 'users');
      // Simplified query to fetch all users without ordering to avoid issues with missing fields.
      const q = query(usersCollection); 
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<UserFromDB, 'id'>) }));
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string, role: 'admin' | 'client' }) => {
      const userRef = doc(db, 'users', id);
      await updateDoc(userRef, { role });
    },
    onSuccess: (_, { role }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Rol Actualizado', description: `El usuario ahora es ${role}.` });
    },
    onError: (error) => {
      toast({ title: 'Error', description: `No se pudo actualizar el rol: ${(error as Error).message}`, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      // This deletes the Firestore user document, but not the Firebase Auth user.
      // Deleting from Auth requires backend functions for security.
      await deleteDoc(doc(db, 'users', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Usuario Eliminado', description: 'El registro del usuario ha sido eliminado de la base de datos.' });
      setShowDeleteDialog(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: `No se pudo eliminar el usuario: ${(error as Error).message}`, variant: 'destructive' });
      setShowDeleteDialog(false);
      setUserToDelete(null);
    },
  });
  
  const handleDeleteClick = (user: UserFromDB) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>Gestiona los roles y el acceso de los usuarios.</CardDescription>
          <div className="flex items-start gap-2 rounded-lg border bg-secondary/50 p-3 text-sm text-secondary-foreground mt-2">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>
              Para añadir nuevos usuarios, por favor, ve a la sección de <strong>Authentication</strong> en tu Consola de Firebase. Por razones de seguridad, la creación de usuarios está centralizada allí.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="hidden lg:table-cell">Miembro Desde</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-full" /></TableCell>
                    </TableRow>
                  ))
                )}
                {error && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-destructive">
                      <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Error al cargar los usuarios.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && users?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <p className="font-medium">No hay usuarios registrados.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !error && users?.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.displayName || 'N/A'}</TableCell>
                    <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.role === 'client' && (
                               <DropdownMenuItem onClick={() => updateUserRoleMutation.mutate({ id: user.id, role: 'admin'})}>
                                  <ShieldCheck className="mr-2 h-4 w-4" />
                                  Hacer Admin
                               </DropdownMenuItem>
                            )}
                            {user.role === 'admin' && (
                               <DropdownMenuItem onClick={() => updateUserRoleMutation.mutate({ id: user.id, role: 'client'})}>
                                  <UserCog className="mr-2 h-4 w-4" />
                                  Hacer Cliente
                               </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(user)}>
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro de eliminar a {userToDelete?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el registro del usuario de la base de datos, pero su cuenta de autenticación permanecerá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (userToDelete) deleteUserMutation.mutate(userToDelete.id);
              }}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

