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
    const [theme, setTheme] = useState<Theme>('light')
    const [isAuto, setIsAuto] = useState(true)

    // Check time for auto theme
    useEffect(() => {
        if (!isAuto) return

        const checkTime = () => {
            const hour = new Date().getHours()
            // Light mode: 6 AM to 6 PM (18:00)
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
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [theme])

    const toggleTheme = () => {
        setIsAuto(false) // Disable auto mode when manually toggled
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
