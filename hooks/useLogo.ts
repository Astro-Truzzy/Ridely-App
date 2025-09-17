import { useTheme } from '@/contexts/ThemeContext';
import logoLight from '@/assets/images/logo.png';
import logoDark from '@/assets/images/logo.png'; // Replace with actual dark mode logo
  

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
  
  // Currently both themes use the same logo
  // Replace the logoDark import with a specific dark mode logo if needed
  
  // Return different logos based on theme
  const logo = isDark ? logoDark : logoLight;
  
  return { logo };
}