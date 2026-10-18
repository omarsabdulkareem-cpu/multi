/**
 * SERVER-SIDE DNS RESOLVER & OUTBOUND CONNECTION GUARD (PHASE 14.4 - STEP 3)
 *
 * Runs exclusively in the trusted Node.js server environment.
 * Responsibilities:
 * 1. Pre-flight DNS resolution of destination hostnames using trusted Node.js DNS
 * 2. Strict validation of ALL returned IPv4 and IPv6 records (rejecting if ANY address is prohibited)
 * 3. Prevention of Time-of-Check / Time-of-Use (TOCTOU) and DNS-rebinding attacks via custom https.Agent lookup hook
 * 4. Pinned socket connection while maintaining full TLS SNI and certificate identity validation
 * 5. Re-validation of DNS records on every delivery attempt (keepAlive: false)
 * 6. Hard disabling of automatic HTTP redirects (redirect: 'error')
 * 7. Bounded connection / request timeouts and capped response body reading (16KB)
 * 8. Pluggable test hooks for deterministic simulation of DNS rebinding, timeouts, and redirects
 */

import dns from 'dns';
import https from 'https';
import http from 'http';
import tls from 'tls';
import {
  validateWebhookDestination,
  isProhibitedIp,
  normalizeHostname,
  parseIPv4,
  parseIPv6,
  SsrfValidationResult,
} from '../services/webhookSsrfValidator';

export interface ResolvedDnsRecord {
  address: string;
  family: number;
}

export interface DnsValidationResult {
  valid: boolean;
  hostname: string;
  resolvedRecords: ResolvedDnsRecord[];
  reason?: string;
}

export interface OutboundRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface OutboundResponseResult {
  statusCode: number | null;
  headers: Record<string, string>;
  body: string | null;
  durationMs: number;
  errorMessage: string | null;
  resolvedIp?: string;
}

// Pluggable test hooks
export type DnsResolverFn = (hostname: string) => Promise<ResolvedDnsRecord[]>;
export type HttpTransportFn = (
  url: string,
  options: OutboundRequestOptions
) => Promise<OutboundResponseResult>;

let _mockDnsResolver: DnsResolverFn | null = null;
let _mockHttpTransport: HttpTransportFn | null = null;

export class WebhookDnsResolver {
  public static setMockResolver(fn: DnsResolverFn | null): void {
    _mockDnsResolver = fn;
  }

  public static resetMockResolver(): void {
    _mockDnsResolver = null;
  }

  public static setMockTransport(fn: HttpTransportFn | null): void {
    _mockHttpTransport = fn;
  }

  public static resetMockTransport(): void {
    _mockHttpTransport = null;
  }

  /**
   * Resolves a hostname and validates that ALL resolved IP addresses are safe public destinations.
   * If ANY address is private, loopback, link-local, cloud metadata, or reserved, the destination is rejected.
   */
  public static async resolveAndValidate(hostname: string): Promise<DnsValidationResult> {
    const cleanHost = normalizeHostname(hostname);

    if (!cleanHost) {
      return {
        valid: false,
        hostname: cleanHost,
        resolvedRecords: [],
        reason: 'Destination hostname cannot be empty.',
      };
    }

    // If host is already an IP address, validate directly
    const isDirectV4 = parseIPv4(cleanHost) !== null;
    const isDirectV6 = parseIPv6(cleanHost) !== null;

    if (isDirectV4 || isDirectV6) {
      if (isProhibitedIp(cleanHost)) {
        return {
          valid: false,
          hostname: cleanHost,
          resolvedRecords: [{ address: cleanHost, family: isDirectV4 ? 4 : 6 }],
          reason: 'Destination IP address is in a private, loopback, or reserved address range.',
        };
      }
      return {
        valid: true,
        hostname: cleanHost,
        resolvedRecords: [{ address: cleanHost, family: isDirectV4 ? 4 : 6 }],
      };
    }

    // Resolve domain name using mock resolver or Node's dns.promises.lookup
    let records: ResolvedDnsRecord[] = [];
    try {
      if (_mockDnsResolver) {
        records = await _mockDnsResolver(cleanHost);
      } else {
        const raw = await dns.promises.lookup(cleanHost, { all: true });
        records = raw.map((r) => ({ address: r.address, family: r.family }));
      }
    } catch (err: any) {
      return {
        valid: false,
        hostname: cleanHost,
        resolvedRecords: [],
        reason: `DNS resolution failed: ${err.message || 'Host not found'}`,
      };
    }

    if (!records || records.length === 0) {
      return {
        valid: false,
        hostname: cleanHost,
        resolvedRecords: [],
        reason: 'DNS lookup returned zero address records.',
      };
    }

    // Validate EVERY resolved address. If even ONE is prohibited, fail closed!
    for (const rec of records) {
      if (isProhibitedIp(rec.address)) {
        return {
          valid: false,
          hostname: cleanHost,
          resolvedRecords: records,
          reason: 'Destination resolved to prohibited, private, or non-public address.',
        };
      }
    }

    return {
      valid: true,
      hostname: cleanHost,
      resolvedRecords: records,
    };
  }

  /**
   * Dispatches an outbound webhook HTTP request using a connection-pinning,
   * DNS-rebinding-resilient HTTPS agent.
   *
   * Security guarantees:
   * 1. Pre-flight URL syntax and FQDN validation
   * 2. Pre-flight DNS resolution of all IP records
   * 3. Socket-connection-time re-validation of resolved IP via custom lookup hook
   * 4. TLS SNI and server identity verification maintained
   * 5. Automatic redirects strictly disabled
   * 6. Capped response size (16KB)
   * 7. Zero leak of credentials or internal IP addresses
   */
  public static async dispatchSecureRequest(
    destinationUrl: string,
    options: OutboundRequestOptions = {}
  ): Promise<OutboundResponseResult> {
    const start = Date.now();
    const {
      method = 'POST',
      headers = {},
      body = '',
      timeoutMs = 5000,
      maxResponseBytes = 16384,
    } = options;

    // Use mock transport if set (e.g. for deterministic unit testing)
    if (_mockHttpTransport) {
      return _mockHttpTransport(destinationUrl, options);
    }

    // 1. Pre-flight URL Validation
    const urlValidation = validateWebhookDestination(destinationUrl, {
      enforceHttps: true,
      allowedPorts: [443],
    });

    if (!urlValidation.valid) {
      return {
        statusCode: null,
        headers: {},
        body: null,
        durationMs: Date.now() - start,
        errorMessage: `SSRF Blocked: ${urlValidation.reason}`,
      };
    }

    const parsed = new URL(destinationUrl);
    const hostname = parsed.hostname;

    // 2. Pre-flight DNS Resolution & Address Validation
    const dnsCheck = await this.resolveAndValidate(hostname);
    if (!dnsCheck.valid) {
      return {
        statusCode: null,
        headers: {},
        body: null,
        durationMs: Date.now() - start,
        errorMessage: `SSRF Blocked: ${dnsCheck.reason}`,
      };
    }

    // 3. Setup Connection-Time DNS Rebinding Guard
    // When the socket is created, this lookup hook validates the IP address immediately before connection.
    const safeLookup = (
      lookupHost: string,
      lookupOpts: any,
      callback: (err: Error | null, address?: any, family?: number) => void
    ) => {
      const cb = typeof lookupOpts === 'function' ? lookupOpts : callback;
      const opts = typeof lookupOpts === 'object' ? lookupOpts : {};

      const resolvePromise = _mockDnsResolver
        ? _mockDnsResolver(lookupHost)
        : dns.promises.lookup(lookupHost, { all: true });

      resolvePromise
        .then((records: any[]) => {
          if (!records || records.length === 0) {
            return cb(new Error('No DNS records returned at connection time'));
          }

          // Verify every address again at connection time (DNS Rebinding Defense)
          for (const rec of records) {
            if (isProhibitedIp(rec.address)) {
              return cb(new Error('SSRF Blocked: Destination resolved to prohibited IP address at connection time'));
            }
          }

          const primary = records[0];
          if (opts.all) {
            cb(null, records);
          } else {
            cb(null, primary.address, primary.family);
          }
        })
        .catch((err) => {
          cb(err);
        });
    };

    // Construct a non-persistent agent (keepAlive: false) with custom safe lookup
    const agent = new https.Agent({
      lookup: safeLookup as any,
      keepAlive: false,
      minVersion: 'TLSv1.2',
    });

    return new Promise<OutboundResponseResult>((resolve) => {
      let isCompleted = false;
      let timeoutHandle: NodeJS.Timeout | null = null;

      const finish = (result: OutboundResponseResult) => {
        if (isCompleted) return;
        isCompleted = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        agent.destroy();
        resolve(result);
      };

      try {
        const req = https.request(
          destinationUrl,
          {
            method,
            headers,
            agent,
            timeout: timeoutMs,
            servername: hostname, // Maintain TLS SNI
            checkServerIdentity: (host, cert) => tls.checkServerIdentity(hostname, cert), // Full certificate validation
          },
          (res: http.IncomingMessage) => {
            const statusCode = res.statusCode || 200;
            const resHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers)) {
              if (v) resHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
            }

            // 4. Strict Redirect Defense: Disable automatic redirects
            if ([301, 302, 303, 307, 308].includes(statusCode)) {
              res.resume(); // Discard stream
              finish({
                statusCode,
                headers: resHeaders,
                body: null,
                durationMs: Date.now() - start,
                errorMessage: 'SSRF Blocked: Automatic HTTP redirects are disabled for security.',
              });
              return;
            }

            // 5. Capped Body Reading
            let bodyBuffer = '';
            let bytesRead = 0;

            res.on('data', (chunk: Buffer | string) => {
              const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
              bytesRead += Buffer.byteLength(str, 'utf8');

              if (bodyBuffer.length < maxResponseBytes) {
                bodyBuffer += str.slice(0, maxResponseBytes - bodyBuffer.length);
              }

              if (bytesRead > maxResponseBytes) {
                // Destroy response stream once limit reached
                res.destroy();
              }
            });

            res.on('end', () => {
              finish({
                statusCode,
                headers: resHeaders,
                body: bodyBuffer || null,
                durationMs: Date.now() - start,
                errorMessage: null,
              });
            });

            res.on('error', (err: Error) => {
              finish({
                statusCode: null,
                headers: resHeaders,
                body: null,
                durationMs: Date.now() - start,
                errorMessage: err.message || 'Response error',
              });
            });
          }
        );

        // Timeout handler
        timeoutHandle = setTimeout(() => {
          req.destroy(new Error('Connection timeout after ' + timeoutMs + 'ms'));
        }, timeoutMs);

        req.on('error', (err: any) => {
          const msg = err.message || 'Network error';
          finish({
            statusCode: null,
            headers: {},
            body: null,
            durationMs: Date.now() - start,
            errorMessage: msg,
          });
        });

        if (body) {
          req.write(body);
        }
        req.end();
      } catch (err: any) {
        finish({
          statusCode: null,
          headers: {},
          body: null,
          durationMs: Date.now() - start,
          errorMessage: err.message || 'Request initiation failure',
        });
      }
    });
  }
}
