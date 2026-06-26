'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, STRINGS, tFor, langByCode } from '@/lib/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

const LangCtx = createContext({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  languages: LANGUAGES,
  detectedSuggestion: null,
  dismissSuggestion: () => {},
});

export function useLang() {
  return useContext(LangCtx);
}

function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');
  const [hydrated, setHydrated] = useState(false);
  const [detectedSuggestion, setDetectedSuggestion] = useState(null);

  // Hydrate from localStorage / browser detection
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vea_lang');
      if (saved && STRINGS[saved]) {
        setLangState(saved);
        setHydrated(true);
        return;
      }
      const dismissed = localStorage.getItem('vea_lang_dismissed') === '1';
      const browserLang = (navigator.language || 'en').slice(0, 2);
      if (!dismissed && browserLang !== 'en' && STRINGS[browserLang]) {
        setDetectedSuggestion(browserLang);
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist + update <html lang> + dir
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('vea_lang', lang);
      const l = langByCode(lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = l.rtl ? 'rtl' : 'ltr';
    } catch {}
  }, [lang, hydrated]);

  const setLang = (code) => {
    setLangState(code);
    setDetectedSuggestion(null);
    try { localStorage.setItem('vea_lang_dismissed', '1'); } catch {}
  };

  const dismissSuggestion = () => {
    setDetectedSuggestion(null);
    try { localStorage.setItem('vea_lang_dismissed', '1'); } catch {}
  };

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (k) => tFor(lang, k),
    languages: LANGUAGES,
    detectedSuggestion,
    dismissSuggestion,
  }), [lang, detectedSuggestion]);

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{children}</LanguageProvider>
    </QueryClientProvider>
  );
}
