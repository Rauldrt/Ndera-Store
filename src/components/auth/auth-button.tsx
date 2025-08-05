
'use client';

import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function AuthButton() {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Or a skeleton button
  }

  if (user && user.role === 'admin') {
    return (
      <Link href="/">
        <Button variant="outline">Volver a Gestión</Button>
      </Link>
    );
  }

  return (
    <Link href="/login">
      <Button variant="default">Iniciar Sesión</Button>
    </Link>
  );
}
