
'use client';

import { CartSheet } from "@/components/cart/cart-sheet";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function ItemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Simplified layout without the sidebar for the client view
    <div>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-xl font-bold text-primary">
            Catalogify
          </Link>
          <div className="flex items-center gap-2">
             <CartSheet />
             <Link href="/" className="hidden sm:inline-flex">
                <Button variant="outline">
                    Volver a Gestión
                </Button>
             </Link>
          </div>
        </div>
      </header>
      <main>
        {children}
      </main>
      <footer className="border-t bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} Catalogify. Todos los derechos reservados.</p>
          </div>
      </footer>
    </div>
  );
}
