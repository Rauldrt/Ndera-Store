
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
        <AlertTriangle className="w-24 h-24 text-destructive mb-4" />
        <h1 className="text-4xl font-bold mb-2">404 - Página no Encontrada</h1>
        <p className="text-lg text-muted-foreground mb-6">
            Lo sentimos, no pudimos encontrar la página que estás buscando.
        </p>
        <Link href="/">
            <Button>Volver al inicio</Button>
        </Link>
    </div>
  )
}
