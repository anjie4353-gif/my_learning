import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'AnjieMart — Enterprise E-Commerce',
  description: 'Modern enterprise e-commerce storefront with WhatsApp ordering.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
