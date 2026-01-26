import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
    theme: Theme
    toggleTheme: () => void
    isAuto: boolean
    setIsAuto: (isAuto: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Default to dark theme (QuantFlow style)
    const [theme, setTheme] = useState<Theme>('dark')
    const [isAuto, setIsAuto] = useState(false)

    // Check time for auto theme
    useEffect(() => {
        if (!isAuto) return

        const checkTime = () => {
            const hour = new Date().getHours()
            const isLight = hour >= 6 && hour < 18
            setTheme(isLight ? 'light' : 'dark')
        }

        checkTime()
        const interval = setInterval(checkTime, 60000)
        return () => clearInterval(interval)
    }, [isAuto])

    // Apply theme to document
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
            document.documentElement.classList.remove('light-mode')
        } else {
            document.documentElement.classList.remove('dark')
            document.documentElement.classList.add('light-mode')
        }
    }, [theme])

    const toggleTheme = () => {
        setIsAuto(false)
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isAuto, setIsAuto }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
