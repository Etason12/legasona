import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './translations'

const LanguageContext = createContext()

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')

  const t = (key) => translations[lang]?.[key] || translations['en']?.[key] || key

  const changeLanguage = (code) => {
    setLang(code)
    localStorage.setItem('lang', code)
    // Apply RTL/font changes if needed
    document.documentElement.lang = code
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, t, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
