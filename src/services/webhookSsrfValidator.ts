/**
 * SERVER-SIDE WEBHOOK SSRF VALIDATOR & DESTINATION GUARD (PHASE 14.4 - STEP 3)
 *
 * Implements strict zero-trust URL and IP validation to prevent:
 * 1. Server-Side Request Forgery (SSRF) against internal VPCs, localhost, and internal services
 * 2. Cloud metadata extraction (169.254.169.254, metadata.google.internal, 100.100.100.200)
 * 3. Private RFC 1918 / IPv6 local network access (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * 4. IPv6 link-local, unique-local, loopback, and IPv4-mapped IPv6 evasions
 * 5. Alternate IP representations (hex, octal, decimal, dotless numbers)
 * 6. Insecure protocols and unauthorized port probing
 *
 * Designed to be 100% browser-safe and server-compatible (zero Node-specific imports).
 */

export interface SsrfValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  reason?: string;
  normalizedHostname?: string;
  port?: number;
}

export interface WebhookValidationOptions {
  enforceHttps?: boolean;
  allowedPorts?: number[];
}

// Blocked hostnames and prefixes
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata.google',
  'instance-data',
  'metadata',
  '169.254.169.254',
  '100.100.100.200', // Alibaba cloud metadata
];

// Default safe port is HTTPS 443 exclusively
const DEFAULT_ALLOWED_PORTS = [443];

/**
 * Normalizes a hostname string: converts to lowercase, trims whitespace, strips trailing dots.
 */
export function normalizeHostname(hostname: string): string {
  let h = (hostname || '').toLowerCase().trim();
  // Strip trailing dots
  h = h.replace(/\.+$/, '');
  // Strip surrounding brackets for IPv6
  if (h.startsWith('[') && h.endsWith(']')) {
    h = h.slice(1, -1);
  }
  return h;
}

/**
 * Parses an IPv4 address string into an array of 4 octet numbers.
 * Returns null if invalid or not a valid dotted quad.
 */
export function parseIPv4(ip: string): number[] | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return null;
    nums.push(num);
  }
  return nums;
}

/**
 * Checks if an IPv4 address belongs to a private, loopback, link-local, multicast,
 * carrier-grade NAT, or reserved range.
 */
export function isPrivateOrReservedIPv4(ip: string | number[]): boolean {
  const parts = Array.isArray(ip) ? ip : parseIPv4(ip);
  if (!parts || parts.length !== 4) return false;

  const [a, b, c] = parts;

  // 0.0.0.0/8 (Current network / "this" host)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private RFC 1918)
  if (a === 10) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT / RFC 6598: 100.64.0.0 - 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-local / Cloud metadata: 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1 documentation)
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.88.99.0/24 (6to4 Relay Anycast)
  if (a === 192 && b === 88 && c === 99) return true;

  // 192.168.0.0/16 (Private RFC 1918)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Network benchmark testing: 198.18.0.0 - 198.19.255.255)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2 documentation)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3 documentation)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future use / Limited broadcast 255.255.255.255)
  if (a >= 240) return true;

  return false;
}

/**
 * Parses an IPv6 address string into an array of 8 16-bit words.
 * Correctly expands compressed "::" syntax and handles IPv4-mapped IPv6.
 */
export function parseIPv6(ip: string): number[] | null {
  let clean = ip.toLowerCase().trim();
  if (clean.startsWith('[') && clean.endsWith(']')) clean = clean.slice(1, -1);
  const zoneIdx = clean.indexOf('%');
  if (zoneIdx !== -1) clean = clean.slice(0, zoneIdx);

  // Check for IPv4 mapped at the end, e.g. ::ffff:192.168.1.1
  const lastColon = clean.lastIndexOf(':');
  if (lastColon !== -1) {
    const potIpv4 = clean.slice(lastColon + 1);
    if (potIpv4.includes('.')) {
      const parts = parseIPv4(potIpv4);
      if (parts) {
        const h1 = ((parts[0] << 8) | parts[1]).toString(16);
        const h2 = ((parts[2] << 8) | parts[3]).toString(16);
        clean = clean.slice(0, lastColon + 1) + h1 + ':' + h2;
      }
    }
  }

  const colons = clean.split('::');
  if (colons.length > 2) return null;

  let words: string[] = [];
  if (colons.length === 2) {
    const left = colons[0] ? colons[0].split(':') : [];
    const right = colons[1] ? colons[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    words = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    words = clean.split(':');
  }

  if (words.length !== 8) return null;
  const numWords = words.map((w) => parseInt(w || '0', 16));
  if (numWords.some((w) => isNaN(w) || w < 0 || w > 0xffff)) return null;
  return numWords;
}

/**
 * Checks if an IPv6 address belongs to a private, loopback, link-local,
 * unique-local, multicast, documentation, or IPv4-mapped private range.
 */
export function isPrivateOrReservedIPv6(words: string | number[]): boolean {
  const numWords = Array.isArray(words) ? words : parseIPv6(words);
  if (!numWords || numWords.length !== 8) return false;

  // :: (Unspecified)
  if (numWords.every((w) => w === 0)) return true;

  // ::1 (Loopback)
  if (numWords.slice(0, 7).every((w) => w === 0) && numWords[7] === 1) return true;

  // ::ffff:0:0/96 (IPv4-mapped IPv6)
  if (numWords.slice(0, 5).every((w) => w === 0) && numWords[5] === 0xffff) {
    const a = (numWords[6] >> 8) & 0xff;
    const b = numWords[6] & 0xff;
    const c = (numWords[7] >> 8) & 0xff;
    const d = numWords[7] & 0xff;
    return isPrivateOrReservedIPv4([a, b, c, d]);
  }

  // ::/96 (IPv4-compatible IPv6)
  if (numWords.slice(0, 6).every((w) => w === 0)) {
    const a = (numWords[6] >> 8) & 0xff;
    const b = numWords[6] & 0xff;
    const c = (numWords[7] >> 8) & 0xff;
    const d = numWords[7] & 0xff;
    return isPrivateOrReservedIPv4([a, b, c, d]);
  }

  // fc00::/7 (Unique Local Address - ULA, private)
  if ((numWords[0] & 0xfe00) === 0xfc00) return true;

  // fe80::/10 (Link-Local)
  if ((numWords[0] & 0xffc0) === 0xfe80) return true;

  // ff00::/8 (Multicast)
  if ((numWords[0] & 0xff00) === 0xff00) return true;

  // 2001:db8::/32 (Documentation)
  if (numWords[0] === 0x2001 && numWords[1] === 0x0db8) return true;

  // 100::/64 (Discard-only)
  if (numWords[0] === 0x0100 && numWords[1] === 0) return true;

  // 2001:20::/28 (ORCHIDv2)
  if (numWords[0] === 0x2001 && (numWords[1] & 0xfff0) === 0x0020) return true;

  // 64:ff9b::/96 (IPv4/IPv6 translation)
  if (numWords[0] === 0x0064 && numWords[1] === 0xff9b) return true;

  return false;
}

/**
 * Universal check: verifies if an IP address (IPv4 or IPv6 string) is prohibited.
 */
export function isProhibitedIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;
  const clean = normalizeHostname(ip);

  // Check IPv4
  const v4 = parseIPv4(clean);
  if (v4) {
    return isPrivateOrReservedIPv4(v4);
  }

  // Check IPv6
  const v6 = parseIPv6(clean);
  if (v6) {
    return isPrivateOrReservedIPv6(v6);
  }

  return false;
}

/**
 * Validates a destination webhook URL against SSRF, unauthorized protocols,
 * embedded credentials, unsupported ports, and private/internal IP targets.
 *
 * @param urlString - The destination URL string
 * @param options - Configurable validation options
 */
export function validateWebhookDestination(
  urlString: string,
  options: WebhookValidationOptions = {}
): SsrfValidationResult {
  const {
    enforceHttps = true,
    allowedPorts = DEFAULT_ALLOWED_PORTS,
  } = options;

  if (!urlString || typeof urlString !== 'string' || !urlString.trim()) {
    return { valid: false, reason: 'URL cannot be empty.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { valid: false, reason: 'Malformed URL syntax.' };
  }

  // 1. Protocol Validation
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      valid: false,
      reason: `Disallowed protocol "${parsed.protocol}". Only HTTPS endpoints are permitted.`,
    };
  }

  if (enforceHttps && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: 'Insecure protocol. Webhooks must use encrypted HTTPS in production.',
    };
  }

  // 2. Reject credentials in URL (e.g. https://user:pass@domain.com)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: 'User credentials (username/password) are not permitted in webhook URLs.',
    };
  }

  // 3. Port Restriction
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  const portNumber = parsed.port ? parseInt(parsed.port, 10) : defaultPort;
  if (isNaN(portNumber) || !allowedPorts.includes(portNumber)) {
    return {
      valid: false,
      reason: `Disallowed port "${portNumber}". Only safe ports (${allowedPorts.join(', ')}) are allowed.`,
    };
  }

  // 4. Hostname Normalization & Check
  const rawHostname = parsed.hostname;
  const hostname = normalizeHostname(rawHostname);

  if (!hostname) {
    return { valid: false, reason: 'Destination hostname cannot be empty.' };
  }

  // 5. Blocked hostname strings and localhost variants
  if (
    BLOCKED_HOSTNAMES.includes(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    return {
      valid: false,
      reason: `Forbidden target host "${hostname}". Localhost and internal cloud metadata destinations are blocked.`,
    };
  }

  // 6. Cloud Metadata Protection keywords
  if (
    hostname.includes('169.254') ||
    hostname.includes('metadata.google') ||
    hostname.includes('instance-data')
  ) {
    return {
      valid: false,
      reason: 'Access to cloud instance metadata services is strictly prohibited.',
    };
  }

  // 7. Direct IP Address Validation (handles standard, alternate numeric, and IPv6)
  if (isProhibitedIp(hostname)) {
    return {
      valid: false,
      reason: `Destination IP address is in a private, loopback, or reserved address range.`,
    };
  }

  // 8. TLD & FQDN check: destination hostname must be a fully-qualified domain name with dot or valid public IP
  const isDirectIp = parseIPv4(hostname) !== null || parseIPv6(hostname) !== null;
  if (!isDirectIp && !hostname.includes('.')) {
    return {
      valid: false,
      reason: 'Webhook destination hostname must be a fully-qualified domain name (FQDN).',
    };
  }

  return {
    valid: true,
    sanitizedUrl: parsed.toString(),
    normalizedHostname: hostname,
    port: portNumber,
  };
}
