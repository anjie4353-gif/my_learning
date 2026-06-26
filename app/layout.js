import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'Visual Engineering AI — Understand Any Concept Through Interactive Visuals',
  description: 'Type any technical concept and instantly get an interactive visual diagram, animated walkthrough, formulas, and an AI tutor.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
        <Toaster theme="dark" position="bottom-center" toastOptions={{ style: { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' } }} />
      </body>
    </html>
  )
}
