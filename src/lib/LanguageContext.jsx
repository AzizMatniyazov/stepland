import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './i18n'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('stepland_lang') || 'uz'
  })

  useEffect(() => {
    localStorage.setItem('stepland_lang', lang)
  }, [lang])

  const t = translations[lang]

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}