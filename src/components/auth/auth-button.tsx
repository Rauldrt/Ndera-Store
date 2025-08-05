
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function AuthButton() {
  return (
    <Link href="/login">
      <Button variant="default">Iniciar Sesión</Button>
    </Link>
  );
}
