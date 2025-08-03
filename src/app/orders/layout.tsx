
'use client';

import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-primary">
            Historial de Pedidos
          </h1>
          <Link href="/">
            <Button variant="outline">
                Volver a Gestión
            </Button>
          </Link>
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}
