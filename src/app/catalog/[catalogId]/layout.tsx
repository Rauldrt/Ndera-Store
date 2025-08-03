
import { CartSheet } from "@/components/cart/cart-sheet";
import Link from 'next/link';
import type { Metadata, ResolvingMetadata } from 'next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Catalog } from '@/types';

type Props = {
    params: { catalogId: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const catalogId = params.catalogId;

  try {
    const docRef = doc(db, 'catalogs', catalogId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const catalog = docSnap.data() as Catalog;
      const previousImages = (await parent).openGraph?.images || []
      
      return {
        title: `${catalog.name} | Catalogify`,
        description: catalog.description,
        openGraph: {
          title: catalog.name,
          description: catalog.description,
          images: [catalog.imageUrl || `https://placehold.co/1200x630.png`, ...previousImages],
        },
      }
    } else {
      return {
        title: 'Catálogo no Encontrado',
        description: 'El catálogo que buscas no existe o ha sido eliminado.',
      }
    }
  } catch (error) {
     console.error("Error generating metadata:", error);
     return {
        title: 'Error de Catálogo',
        description: 'No se pudo cargar la información del catálogo.',
     }
  }
}

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/items" className="text-xl font-bold text-primary">
            Catalogify
          </Link>
          <div className="flex items-center gap-2">
             <CartSheet />
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
