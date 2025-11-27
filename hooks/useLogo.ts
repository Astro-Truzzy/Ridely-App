import { useTheme } from '@/contexts/ThemeContext';
import logoDark from '@/assets/images/logo.png';
import logoLight from '@/assets/images/logo-dark.png';
import { StyleSheet } from 'react-native';
  

/**
 * Custom hook to get the appropriate logo based on the current theme.
 * This allows for different logos in light and dark modes.
 * 
 * To use different logos for light and dark modes:
 * 1. Add a dark mode logo asset (e.g., logo-dark.png) to the assets/images folder
 * 2. Import it at the top of this file: import logoDark from '@/assets/images/logo-dark.png';
 * 3. Update the logoDark import on line 6 to point to your new dark mode logo
 * 
 * @returns Object containing the appropriate logo for the current theme
 */
export function useLogo() {
  const { isDark } = useTheme();
  
  // Return different logos based on theme
  const logo = isDark ? logoDark : logoLight;
  return { logo };
}

const styles = StyleSheet.create({
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    padding: 8,
  },
});