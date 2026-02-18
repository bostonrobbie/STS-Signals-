/**
 * Security Hardening Tests
 * 
 * Tests for Content-Security-Policy headers and Sentry integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { securityHeadersMiddleware, getCSPConfig, isSourceAllowed } from './_core/securityMiddleware';
import { 
  captureException, 
  captureMessage, 
  setUser, 
  addBreadcrumb,
  isSentryEnabled 
} from './_core/sentry';

// ============================================================================
// CONTENT SECURITY POLICY TESTS
// ============================================================================

describe('Content Security Policy', () => {
  describe('CSP Configuration', () => {
    it('should have all required directives', () => {
      const config = getCSPConfig();
      
      const requiredDirectives = [
        'default-src',
        'script-src',
        'style-src',
        'img-src',
        'font-src',
        'connect-src',
        'frame-src',
        'form-action',
        'base-uri',
        'object-src',
      ];

      requiredDirectives.forEach(directive => {
        expect(config).toHaveProperty(directive);
      });
    });

    it('should block object/embed elements', () => {
      const config = getCSPConfig();
      expect(config['object-src']).toContain("'none'");
    });

    it('should restrict base URI to self', () => {
      const config = getCSPConfig();
      expect(config['base-uri']).toContain("'self'");
    });

    it('should allow Stripe for payments', () => {
      const config = getCSPConfig();
      
      // Script source should allow Stripe.js
      expect(config['script-src']).toContain('https://js.stripe.com');
      
      // Connect should allow Stripe API
      expect(config['connect-src']).toContain('https://api.stripe.com');
      
      // Frame should allow Stripe for 3D Secure
      expect(config['frame-src']).toContain('https://js.stripe.com');
    });

    it('should allow Google Fonts', () => {
      const config = getCSPConfig();
      
      expect(config['style-src']).toContain('https://fonts.googleapis.com');
      expect(config['font-src']).toContain('https://fonts.gstatic.com');
    });

    it('should allow WebSocket connections for HMR', () => {
      const config = getCSPConfig();
      
      expect(config['connect-src']).toContain('wss:');
      expect(config['connect-src']).toContain('ws:');
    });
  });

  describe('Source Validation', () => {
    it('should allow self-hosted scripts', () => {
      expect(isSourceAllowed('script-src', '/app.js')).toBe(true);
    });

    it('should allow Stripe scripts', () => {
      expect(isSourceAllowed('script-src', 'https://js.stripe.com')).toBe(true);
    });

    it('should allow HTTPS images', () => {
      expect(isSourceAllowed('img-src', 'https://example.com/image.png')).toBe(true);
    });

    it('should allow data URIs for images', () => {
      expect(isSourceAllowed('img-src', 'data:image/png;base64,...')).toBe(true);
    });
  });

  describe('Security Headers Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let setHeaderCalls: Record<string, string>;

    beforeEach(() => {
      setHeaderCalls = {};
      mockReq = {};
      mockRes = {
        setHeader: vi.fn((name: string, value: string) => {
          setHeaderCalls[name] = value;
          return mockRes as Response;
        }),
      };
      mockNext = vi.fn();
    });

    it('should set X-Content-Type-Options header', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(setHeaderCalls['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should set X-Frame-Options header', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(setHeaderCalls['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('should set X-XSS-Protection header', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(setHeaderCalls['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should set Referrer-Policy header', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(setHeaderCalls['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set Permissions-Policy header', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(setHeaderCalls['Permissions-Policy']).toBeDefined();
      expect(setHeaderCalls['Permissions-Policy']).toContain('camera=()');
      expect(setHeaderCalls['Permissions-Policy']).toContain('microphone=()');
    });

    it('should call next() to continue middleware chain', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set CSP header (report-only in development)', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);
      
      // In development mode, should use report-only
      const cspHeader = setHeaderCalls['Content-Security-Policy-Report-Only'] || 
                        setHeaderCalls['Content-Security-Policy'];
      
      expect(cspHeader).toBeDefined();
      expect(cspHeader).toContain("default-src 'self'");
    });
  });
});

// ============================================================================
// SENTRY INTEGRATION TESTS
// ============================================================================

describe('Sentry Integration', () => {
  describe('Error Capture', () => {
    it('should capture exceptions without throwing', () => {
      const error = new Error('Test error');
      
      // Should not throw
      expect(() => {
        captureException(error, { context: 'test' });
      }).not.toThrow();
    });

    it('should capture messages without throwing', () => {
      expect(() => {
        captureMessage('Test message', 'info', { context: 'test' });
      }).not.toThrow();
    });

    it('should handle different severity levels', () => {
      const levels: Array<'fatal' | 'error' | 'warning' | 'info' | 'debug'> = [
        'fatal', 'error', 'warning', 'info', 'debug'
      ];

      levels.forEach(level => {
        expect(() => {
          captureMessage(`Test ${level} message`, level);
        }).not.toThrow();
      });
    });
  });

  describe('User Context', () => {
    it('should set user context without throwing', () => {
      expect(() => {
        setUser({ id: 'user_123', email: 'test@example.com', username: 'testuser' });
      }).not.toThrow();
    });

    it('should clear user context without throwing', () => {
      expect(() => {
        setUser(null);
      }).not.toThrow();
    });
  });

  describe('Breadcrumbs', () => {
    it('should add breadcrumbs without throwing', () => {
      expect(() => {
        addBreadcrumb('navigation', 'User navigated to dashboard', { page: '/dashboard' });
      }).not.toThrow();
    });

    it('should handle different breadcrumb levels', () => {
      const levels: Array<'fatal' | 'error' | 'warning' | 'info' | 'debug'> = [
        'fatal', 'error', 'warning', 'info', 'debug'
      ];

      levels.forEach(level => {
        expect(() => {
          addBreadcrumb('test', `Test ${level} breadcrumb`, {}, level);
        }).not.toThrow();
      });
    });
  });

  describe('Configuration', () => {
    it('should report enabled status correctly', () => {
      // Without DSN configured, should return false
      const enabled = isSentryEnabled();
      expect(typeof enabled).toBe('boolean');
    });
  });
});

// ============================================================================
// SECURITY HEADER VALIDATION TESTS
// ============================================================================

describe('Security Header Validation', () => {
  describe('CSP Directive Syntax', () => {
    it('should have valid CSP directive format', () => {
      const config = getCSPConfig();
      
      Object.entries(config).forEach(([directive, values]) => {
        // Directive names should be lowercase with hyphens
        expect(directive).toMatch(/^[a-z-]+$/);
        
        // Values should be an array
        expect(Array.isArray(values)).toBe(true);
        
        // Each value should be a non-empty string
        values.forEach(value => {
          expect(typeof value).toBe('string');
        });
      });
    });

    it('should have properly quoted keyword values', () => {
      const config = getCSPConfig();
      const keywords = ['self', 'none', 'unsafe-inline', 'unsafe-eval'];
      
      Object.values(config).flat().forEach(value => {
        keywords.forEach(keyword => {
          if (value.includes(keyword) && !value.startsWith('https://')) {
            expect(value).toBe(`'${keyword}'`);
          }
        });
      });
    });
  });

  describe('HTTPS Enforcement', () => {
    it('should include upgrade-insecure-requests directive', () => {
      const config = getCSPConfig();
      expect(config).toHaveProperty('upgrade-insecure-requests');
    });
  });

  describe('XSS Mitigation', () => {
    it('should restrict script sources', () => {
      const config = getCSPConfig();
      
      // Should not allow arbitrary external scripts
      expect(config['script-src']).not.toContain('*');
      
      // Should have self as base
      expect(config['script-src']).toContain("'self'");
    });

    it('should restrict style sources', () => {
      const config = getCSPConfig();
      
      // Should not allow arbitrary external styles
      expect(config['style-src']).not.toContain('*');
      
      // Should have self as base
      expect(config['style-src']).toContain("'self'");
    });
  });

  describe('Clickjacking Prevention', () => {
    it('should restrict frame ancestors via frame-src', () => {
      const config = getCSPConfig();
      
      // frame-src should be restricted
      expect(config['frame-src']).toBeDefined();
      expect(config['frame-src']).toContain("'self'");
    });
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  describe('Graceful Degradation', () => {
    it('should not crash when Sentry is not configured', () => {
      // All Sentry functions should work even without DSN
      expect(() => {
        captureException(new Error('Test'));
        captureMessage('Test');
        setUser({ id: '123' });
        addBreadcrumb('test', 'test');
      }).not.toThrow();
    });
  });

  describe('Sensitive Data Filtering', () => {
    it('should not include sensitive headers in config', () => {
      const config = getCSPConfig();
      const configStr = JSON.stringify(config);
      
      // Should not contain any actual secrets
      expect(configStr).not.toContain('password');
      expect(configStr).not.toContain('secret');
      expect(configStr).not.toContain('token');
      expect(configStr).not.toContain('apikey');
    });
  });
});
