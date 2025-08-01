
'use client';

import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import Link from 'next/link';

export default function ItemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        {/* El contenido de la barra lateral puede estar vacío o tener navegación específica si es necesario */}
        <SidebarHeader>
           <Link href="/" className="text-lg font-semibold text-sidebar-primary group-data-[collapsible=icon]:hidden">
            Catalogify
          </Link>
        </SidebarHeader>
        <SidebarContent />
      </Sidebar>
      <SidebarInset>
         <div className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-20">
          <h1 className="text-lg font-semibold text-primary truncate">
             Todos los Productos
          </h1>
          <Link href="/"><SidebarTrigger /></Link>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
