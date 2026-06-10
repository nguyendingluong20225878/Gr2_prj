/**
 * Navigation utility to support both Figma Make (React Router) and Next.js
 * This allows components to work in both environments
 */

// Check if we're in Next.js environment
const isNextJS = typeof window !== 'undefined' && '__NEXT_DATA__' in window;

// Safe navigation hook that works in both environments
export function useSafeNavigate() {
  if (isNextJS) {
    // In Next.js, we'd use useRouter from next/navigation
    // For now, return a fallback
    return (path: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = path;
      }
    };
  } else {
    // In Figma Make/Vite, use React Router
    try {
      // Dynamic import to avoid errors when react-router is not in context
      const { useNavigate } = require('react-router');
      return useNavigate() as (path: string) => void;
    } catch (error) {
      // Fallback if no router is available
      return (path: string) => {
        if (typeof window !== 'undefined') {
          window.location.href = path;
        }
      };
    }
  }
}

// Safe useParams hook
export function useSafeParams<T extends Record<string, string>>(): Partial<T> {
  if (isNextJS) {
    // In Next.js, we'd use useParams from next/navigation
    return {};
  } else {
    try {
      const { useParams } = require('react-router');
      return useParams() as Partial<T>;
    } catch (error) {
      return {};
    }
  }
}

// Safe useLocation hook
export function useSafeLocation() {
  if (isNextJS) {
    // In Next.js, we'd use usePathname from next/navigation
    return { pathname: typeof window !== 'undefined' ? window.location.pathname : '/' };
  } else {
    try {
      const { useLocation } = require('react-router');
      return useLocation();
    } catch (error) {
      return { pathname: typeof window !== 'undefined' ? window.location.pathname : '/' };
    }
  }
}
