import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

export const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#f5f0ff',
      100: '#e3d4ff',
      200: '#c9aaff',
      300: '#aa7dff',
      400: '#8a4fff',
      500: '#7028ff',
      600: '#5a17e6',
      700: '#430fb3',
      800: '#2e0a80',
      900: '#19044d',
    },
    severity: {
      red: '#e53e3e',
      yellow: '#dd9b15',
      green: '#38a169',
    },
  },
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.900',
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'xl',
      },
    },
    Card: {
      baseStyle: {
        container: {
          borderRadius: '2xl',
        },
      },
    },
  },
});
