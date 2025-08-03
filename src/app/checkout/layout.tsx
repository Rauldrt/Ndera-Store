
'use client';

import { Button } from "@/components/ui/button";
import Link from 'next/link';
import React, { useState, useEffect } from 'react';

const LAST_VISITED_CATALOG_KEY = 'lastVisitedCatalogId';


export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [backToShopUrl, setBackToShopUrl] = useState('/items');

  useEffect(() => {
    // This code runs only on the client, after hydration
    const lastCatalogId = localStorage.getItem(LAST_VISITED_CATALOG_KEY);
    if (lastCatalogId) {
      setBackToShopUrl(`/catalog/${lastCatalogId}`);
    } else {
      setBackToShopUrl('/items');
    }
  }, []);


  return (
    <div>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href={backToShopUrl} className="text-xl font-bold text-primary">
            Catalogify
          </Link>
          <Link href={backToShopUrl}>
            <Button variant="outline">
                Volver a la tienda
            </Button>
          </Link>
        </div>
      </header>
      <main className="bg-muted/40">
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
