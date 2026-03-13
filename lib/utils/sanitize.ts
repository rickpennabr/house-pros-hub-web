/**
 * Sanitization utilities for user input
 *
 * In Node (API routes, SSR) we use regex-based stripping to avoid loading
 * isomorphic-dompurify → jsdom → parse5 (ESM), which causes ERR_REQUIRE_ESM on Vercel.
 * In the browser we lazy-load DOMPurify for full XSS protection.
 */

/** Strip HTML tags and normalize whitespace (server-safe, no DOM) */
function stripHtmlTagsServer(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Lazy-load DOMPurify only in browser so Node never loads jsdom */
function getDOMPurify(): { sanitize: (html: string, options?: object) => string } | null {
  if (typeof window === 'undefined') return null;
  try {
    return require('isomorphic-dompurify').default;
  } catch {
    return null;
  }
}

/**
 * Sanitizes HTML content to prevent XSS attacks
 *
 * @param html - HTML string to sanitize
 * @param allowHtml - Whether to allow HTML tags (default: false, only text)
 * @returns Sanitized string
 */
export function sanitizeHtml(html: string, allowHtml: boolean = false): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  if (typeof window === 'undefined') {
    return stripHtmlTagsServer(html);
  }

  const DOMPurify = getDOMPurify();
  if (!DOMPurify) return stripHtmlTagsServer(html);

  if (allowHtml) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
    });
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitizes plain text input (removes HTML and dangerous characters)
 *
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (typeof window === 'undefined') {
    return stripHtmlTagsServer(text);
  }

  const DOMPurify = getDOMPurify();
  if (!DOMPurify) return stripHtmlTagsServer(text);

  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Sanitizes a URL to prevent XSS and malicious redirects
 * 
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    // Return the sanitized URL
    return parsed.toString();
  } catch {
    // Invalid URL
    return '';
  }
}

/**
 * Sanitizes an object's string values recursively
 * 
 * @param obj - Object to sanitize
 * @param allowHtml - Whether to allow HTML in string values
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  allowHtml: boolean = false
): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      (sanitized as Record<string, unknown>)[key] = allowHtml
        ? sanitizeHtml(sanitized[key] as string, true)
        : sanitizeText(sanitized[key] as string);
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeObject(sanitized[key] as Record<string, unknown>, allowHtml) as T[typeof key];
    } else if (Array.isArray(sanitized[key])) {
      sanitized[key] = (sanitized[key] as unknown[]).map((item) => {
        if (typeof item === 'string') {
          return allowHtml ? sanitizeHtml(item, true) : sanitizeText(item);
        }
        if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>, allowHtml);
        }
        return item;
      }) as T[typeof key];
    }
  }

  return sanitized;
}

/**
 * Escapes special characters for safe display in HTML
 * This is a simpler alternative to DOMPurify for plain text
 * 
 * @param text - Text to escape
 * @returns Escaped text safe for HTML display
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

