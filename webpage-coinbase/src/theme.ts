import { extendTheme } from '@chakra-ui/react'

const theme = extendTheme({
  config: { initialColorMode: 'light', useSystemColorMode: false },
  fonts: {
    heading: `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`,
    body: `'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`
  },
  semanticTokens: {
    colors: {
      // 背景
      bg: { default: '#ffffff', _dark: '#0b0e1a' },
      // 文字
      fg: { default: '#0f111a', _dark: '#f0f4f8' },
      // 次要文字
      fgMuted: { default: '#5b6474', _dark: '#a0aec0' },
      // 卡片背景
      cardBg: { default: '#f7f9fc', _dark: 'rgba(16,22,43,0.55)' },
      // 边框/分割线
      border: { default: '#e5e9f2', _dark: 'rgba(255,255,255,0.08)' },
      // 悬浮高亮背景
      hoverBg: { default: '#eef2f8', _dark: 'rgba(255,255,255,0.05)' },
      // 主按钮背景
      primary: { default: '#0052ff', _dark: '#0052ff' },
      // 成功色
      success: { default: '#0e9f6e', _dark: '#31c48d' },
      // 危险色
      danger: { default: '#e02424', _dark: '#f05252' }
    }
  },
  colors: {
    brand: {
      50: '#e6f0ff',
      100: '#cce0ff',
      200: '#99c2ff',
      300: '#66a3ff',
      400: '#3385ff',
      500: '#0052ff',
      600: '#0046d9',
      700: '#0039b3',
      800: '#002d8c',
      900: '#002066'
    },
    surface: {
      50: '#f7f9fc',
      100: '#eef2f8',
      200: '#d6e4f1',
      300: '#b4cdeb',
      400: '#8ab0e0',
      500: '#5d8dd6',
      600: '#3c6fc7',
      700: '#2a5bb8',
      800: '#1a4488',
      900: '#0a1a3a'
    }
  },
  shadows: {
    glass: { default: '0 8px 32px rgba(0,0,0,0.04)', _dark: '0 8px 32px rgba(0,0,0,0.37)' },
    card: { default: '0 2px 12px rgba(0,0,0,0.05)', _dark: '0 4px 30px rgba(0,0,0,0.1)' },
    cardHover: { default: '0 6px 24px rgba(0,0,0,0.08)', _dark: '0 12px 40px rgba(0,0,0,0.4)' }
  },
  styles: {
    global: {
      body: {
        bg: 'bg',
        color: 'fg',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale'
      }
    }
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 600,
        borderRadius: '12px'
      },
      sizes: {
        lg: { h: '48px', fontSize: '16px', px: '24px' }
      }
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'cardBg',
          border: '1px solid',
          borderColor: 'border',
          borderRadius: '16px',
          boxShadow: 'card',
          transition: 'all .25s',
          _hover: { transform: 'translateY(-2px)', boxShadow: 'cardHover' },
          _dark: {
            backdropFilter: 'blur(12px)',
            borderColor: 'border'
          }
        }
      }
    }
  }
})

export default theme