
'use client';

import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function AuthButton() {
  const { user } = useAuth();

  return (
    <>
      {!user ? (
        <Link href="/login">
          <Button variant="default">Iniciar Sesión</Button>
        </Link>
      ) : user.role === 'admin' || user.role === 'usuario' ? (
        <Link href="/">
          <Button variant="outline">Volver a Gestión</Button>
        </Link>
      ) : null}
    </>
  );
}
