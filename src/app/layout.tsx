import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Using Inter font for better readability
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from "@/components/ui/toaster" // Import Toaster

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Catalogify',
  description: 'Manage your catalogs with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
          <Toaster /> {/* Add Toaster component */}
        </Providers>
      </body>
    </html>
  );
}
