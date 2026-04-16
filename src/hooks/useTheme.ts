// =============================================================================
// useTheme — Hook público para consumir el ThemeContext
//
// Uso:
//   const { theme, toggleTheme } = useTheme()
// =============================================================================

import { useThemeContext } from '@/components/providers/ThemeProvider'

export function useTheme() {
  return useThemeContext()
}
