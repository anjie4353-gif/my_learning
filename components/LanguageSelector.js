'use client'

import { Globe, Check } from 'lucide-react'
import { useLang } from '@/app/providers'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function LanguageSelector({ compact = false }) {
  const { lang, setLang, languages, t } = useLang()
  const current = languages.find((l) => l.code === lang) || languages[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? 'sm' : 'default'} className="border-slate-700 bg-slate-800/40 hover:bg-slate-800 gap-2">
          <Globe className="w-4 h-4" />
          <span className="font-medium">{current.native}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[60vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DropdownMenuLabel className="text-slate-400 text-xs uppercase tracking-wide">{t('language')}</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700" />
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className="cursor-pointer focus:bg-slate-800 flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span className="font-medium text-slate-100">{l.native}</span>
              <span className="text-xs text-slate-400">{l.name}</span>
            </div>
            {l.code === lang && <Check className="w-4 h-4 text-purple-400" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
