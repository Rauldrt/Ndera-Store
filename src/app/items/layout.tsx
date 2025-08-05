
'use client';

import { CartSheet } from "@/components/cart/cart-sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import Link from 'next/link';

export default function ItemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  return (
    // Simplified layout without the sidebar for the client view
    <div>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/items" className="text-xl font-bold text-primary">
            Ndera-Store
          </Link>
          <div className="flex items-center gap-2">
             <CartSheet />
             {user ? (
                // If user is logged in, show "Volver a Gestión" only for admin/usuario roles
                (user.role === 'admin' || user.role === 'usuario') && (
                    <Link href="/">
                        <Button variant="outline" className="hidden sm:inline-flex">
                            Volver a Gestión
                        </Button>
                    </Link>
                )
             ) : (
                // If no user is logged in, show "Iniciar Sesión" button
                <Link href="/login">
                    <Button variant="default">
                        Iniciar Sesión
                    </Button>
                </Link>
             )}
          </div>
        </div>
      </header>
      <main>
        {children}
      </main>
      <footer className="border-t bg-background">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} Ndera-Store. Todos los derechos reservados.</p>
          </div>
      </footer>
    </div>
  );
}
