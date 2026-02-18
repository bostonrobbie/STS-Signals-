/**
 * Security Middleware
 * 
 * Implements Content-Security-Policy and other security headers
 * to protect against XSS, clickjacking, and other attacks.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Content Security Policy configuration
 * 
 * This policy restricts which resources can be loaded by the browser,
 * significantly reducing the risk of XSS attacks.
 */
const CSP_DIRECTIVES = {
  // Default fallback for all resource types
  'default-src': ["'self'"],
  
  // Scripts - allow self and inline for React/Vite HMR in development
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Vite HMR and some React patterns
    "'unsafe-eval'", // Required for Vite in development (will be removed in production build)
    "https://js.stripe.com", // Stripe.js
    "https://www.googletagmanager.com", // Analytics (if used)
  ],
  
  // Styles - allow self and inline for Tailwind/styled components
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for Tailwind and dynamic styles
    "https://fonts.googleapis.com",
  ],
  
  // Images - allow self, data URIs, and common CDNs
  'img-src': [
    "'self'",
    "data:",
    "blob:",
    "https:", // Allow HTTPS images (for user avatars, etc.)
  ],
  
  // Fonts - allow self and Google Fonts
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com",
    "data:",
  ],
  
  // API connections - allow self and required external services
  'connect-src': [
    "'self'",
    "https://api.stripe.com", // Stripe API
    "https://api.manus.im", // Manus OAuth
    "wss:", // WebSocket connections (for HMR and real-time features)
    "ws:", // WebSocket in development
  ],
  
  // Frames - restrict to self and Stripe (for 3D Secure)
  'frame-src': [
    "'self'",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
  ],
  
  // Form submissions - restrict to self
  'form-action': ["'self'"],
  
  // Base URI - prevent base tag hijacking
  'base-uri': ["'self'"],
  
  // Object/embed - disable plugins
  'object-src': ["'none'"],
  
  // Upgrade insecure requests in production
  'upgrade-insecure-requests': [],
};

/**
 * Build CSP header string from directives
 */
function buildCSPHeader(isDevelopment: boolean): string {
  const directives = { ...CSP_DIRECTIVES };
  
  // In production, we can be more restrictive
  if (!isDevelopment) {
    // Remove unsafe-eval in production (not needed after build)
    directives['script-src'] = directives['script-src'].filter(
      src => src !== "'unsafe-eval'"
    );
  }
  
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key; // Directives like upgrade-insecure-requests have no values
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Security headers middleware
 * 
 * Adds various security headers to all responses:
 * - Content-Security-Policy: Prevents XSS and data injection attacks
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Legacy XSS protection for older browsers
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Restricts browser features
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Content Security Policy
  const cspHeader = buildCSPHeader(isDevelopment);
  
  // In development, use report-only mode to avoid breaking HMR
  if (isDevelopment) {
    res.setHeader('Content-Security-Policy-Report-Only', cspHeader);
  } else {
    res.setHeader('Content-Security-Policy', cspHeader);
  }
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Legacy XSS protection (for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Restrict browser features
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(self), usb=()'
  );
  
  // Strict Transport Security (HTTPS only in production)
  if (!isDevelopment) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
}

/**
 * Get current CSP configuration for testing/debugging
 */
export function getCSPConfig() {
  return CSP_DIRECTIVES;
}

/**
 * Validate that a source is allowed by CSP
 */
export function isSourceAllowed(directive: keyof typeof CSP_DIRECTIVES, source: string): boolean {
  const allowed = CSP_DIRECTIVES[directive] as readonly string[];
  
  // Check exact match
  if (allowed.includes(source)) return true;
  
  // Check wildcard patterns
  if (allowed.includes("'self'") && source.startsWith('/')) return true;
  if (allowed.includes('https:') && source.startsWith('https://')) return true;
  if (allowed.includes('data:') && source.startsWith('data:')) return true;
  
  return false;
}
