
import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Using Inter font for better readability
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from "@/components/ui/toaster" // Import Toaster
import { CartProvider } from '@/context/cart-context';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ndera-Store',
  description: 'Gestiona tus catálogos con facilidad.',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    shortcut: ['/logo.png'],
    apple: [
      { url: '/logo.png', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <CartProvider>
            {children}
            <Toaster /> {/* Add Toaster component */}
          </CartProvider>
        </Providers>
      </body>
    </html>
  );
}
