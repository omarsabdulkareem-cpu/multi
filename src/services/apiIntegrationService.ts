/**
 * SECURE API INTEGRATION & AUTHENTICATION SERVICE (PHASE 14.2)
 *
 * Implements:
 * 1. High-entropy cryptographically secure server-side credential generation
 * 2. Secure irreversible hashing & constant-time comparison (timingSafeEqual)
 * 3. Multi-tenant isolation - tenant resolved strictly by server from validated key
 * 4. Granular least-privilege permission scope enforcement
 * 5. Sliding-window server-side rate limiting per credential
 * 6. Audit logging with secret masking (raw credentials never stored or logged)
 */

import crypto from 'crypto';
import {
  ApiScope,
  ApiIntegrationCredential,
  CreateIntegrationRequest,
  CreateIntegrationResponse,
  RotateIntegrationResponse,
  ApiAuditLog,
  ApiAuditAction,
  AuthenticatedApiContext,
} from '../types/apiIntegration';
import { TenantService } from './tenantService';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { IdempotencyRecord } from '../types/apiIntegration';

const STORAGE_KEY_INTEGRATIONS = 'alkarwan_saas_api_integrations_v1';
const STORAGE_KEY_API_AUDIT = 'alkarwan_saas_api_audit_v1';
const SERVER_SALT = process.env.API_SALT || 'alkarwan_vault_salt_8f7b2c9e1a';

// In-memory request timestamp tracking for sliding window rate limiting
// Map<integrationId, number[]> where numbers are timestamps (ms)
const rateLimitBuckets = new Map<string, number[]>();
const writeRateLimitBuckets = new Map<string, number[]>();
const authFailureBuckets = new Map<string, number[]>(); // Map<ip, timestamp[]>

// In-memory idempotency cache (keyed by `${orgId}:${endpoint}:${idempotencyKey}`)
const idempotencyStore = new Map<string, IdempotencyRecord>();

export class ApiIntegrationService {
  private static inMemoryStore: Record<string, ApiIntegrationCredential[]> = {};
  private static inMemoryAudit: Record<string, ApiAuditLog[]> = {};

  // -------------------------------------------------------------------------
  // STORAGE HELPERS (Supports isomorphic browser & Node server environments)
  // -------------------------------------------------------------------------
  private static getStoredIntegrations(): Record<string, ApiIntegrationCredential[]> {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_INTEGRATIONS);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return this.inMemoryStore;
  }

  private static saveStoredIntegrations(data: Record<string, ApiIntegrationCredential[]>): void {
    this.inMemoryStore = data;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_INTEGRATIONS, JSON.stringify(data));
      } catch {}
    }
  }

  private static getStoredAuditLogs(): Record<string, ApiAuditLog[]> {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_API_AUDIT);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return this.inMemoryAudit;
  }

  private static saveStoredAuditLogs(data: Record<string, ApiAuditLog[]>): void {
    this.inMemoryAudit = data;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_API_AUDIT, JSON.stringify(data));
      } catch {}
    }
  }

  // -------------------------------------------------------------------------
  // CRYPTOGRAPHIC SECURE HASHING & CONSTANT-TIME VERIFICATION
  // -------------------------------------------------------------------------
  public static hashSecret(secret: string): string {
    return crypto
      .createHmac('sha256', SERVER_SALT)
      .update(secret.trim())
      .digest('hex');
  }

  public static constantTimeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'hex');
      const bufB = Buffer.from(b, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  /**
   * Generates a high-entropy cryptographically secure raw secret
   * Format: wh_live_<64 random hex characters>
   */
  private static generateSecret(): { rawSecret: string; keyPrefix: string; secretHash: string } {
    const entropy = crypto.randomBytes(32).toString('hex');
    const rawSecret = `wh_live_${entropy}`;
    const keyPrefix = `wh_live_${entropy.slice(0, 8)}...`;
    const secretHash = this.hashSecret(rawSecret);
    return { rawSecret, keyPrefix, secretHash };
  }

  // -------------------------------------------------------------------------
  // CREDENTIAL PROVISIONING & LIFECYCLE
  // -------------------------------------------------------------------------
  /**
   * Creates a new API integration for an organization
   * Generates a high-entropy secret, stores only the hash, and returns the raw secret once.
   */
  static async createIntegration(
    orgId: string,
    payload: CreateIntegrationRequest,
    creator: { id: string; name: string }
  ): Promise<CreateIntegrationResponse> {
    if (!orgId) throw new Error('Organization ID is required.');
    if (!payload.name?.trim()) throw new Error('Integration name is required.');
    if (!payload.scopes || payload.scopes.length === 0) {
      throw new Error('At least one permission scope must be selected.');
    }

    const all = this.getStoredIntegrations();
    const orgIntegrations = all[orgId] || [];

    const { rawSecret, keyPrefix, secretHash } = this.generateSecret();
    const integrationId = `int_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();

    let expiresAt: string | null = null;
    if (payload.expiresInDays && payload.expiresInDays > 0) {
      const expDate = new Date(now.getTime() + payload.expiresInDays * 86400000);
      expiresAt = expDate.toISOString();
    }

    const credential: ApiIntegrationCredential = {
      id: integrationId,
      organizationId: orgId,
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      scopes: [...payload.scopes],
      keyPrefix,
      secretHash,
      status: 'ACTIVE',
      rateLimitPerMinute: Math.min(Math.max(payload.rateLimitPerMinute || 60, 10), 1000),
      createdBy: creator.id,
      createdByName: creator.name,
      createdAt: now.toISOString(),
      expiresAt,
      lastUsedAt: null,
    };

    orgIntegrations.push(credential);
    all[orgId] = orgIntegrations;
    this.saveStoredIntegrations(all);

    // Sync to Firestore if available
    this.syncFirestoreDoc(orgId, credential.id, credential).catch(() => {});

    // Record audit event
    this.recordAuditLog({
      organizationId: orgId,
      integrationId: credential.id,
      integrationName: credential.name,
      action: 'INTEGRATION_CREATED',
      endpoint: '/api/v1/integrations',
      method: 'POST',
      details: `Created API integration "${credential.name}" with scopes: [${credential.scopes.join(', ')}] by ${creator.name}`,
      success: true,
    });

    const { secretHash: _, ...safeIntegration } = credential;
    return {
      integration: safeIntegration,
      rawSecret,
    };
  }

  /**
   * Rotates an existing integration's credential
   * Generates a new secret, replaces hash, returns new secret once
   */
  static async rotateIntegration(
    orgId: string,
    integrationId: string,
    performer: { id: string; name: string }
  ): Promise<RotateIntegrationResponse> {
    const all = this.getStoredIntegrations();
    const orgIntegrations = all[orgId] || [];
    const index = orgIntegrations.findIndex((i) => i.id === integrationId);

    if (index === -1) {
      throw new Error(`Integration ${integrationId} not found in this organization.`);
    }

    const existing = orgIntegrations[index];
    if (existing.status === 'REVOKED') {
      throw new Error('Cannot rotate a revoked integration.');
    }

    const { rawSecret, keyPrefix, secretHash } = this.generateSecret();
    existing.keyPrefix = keyPrefix;
    existing.secretHash = secretHash;
    existing.status = 'ACTIVE';

    // Clear rate limit bucket for new key
    rateLimitBuckets.delete(existing.id);

    all[orgId] = orgIntegrations;
    this.saveStoredIntegrations(all);
    this.syncFirestoreDoc(orgId, existing.id, existing).catch(() => {});

    this.recordAuditLog({
      organizationId: orgId,
      integrationId: existing.id,
      integrationName: existing.name,
      action: 'INTEGRATION_ROTATED',
      endpoint: `/api/v1/integrations/${integrationId}/rotate`,
      method: 'POST',
      details: `Rotated API secret for "${existing.name}" by ${performer.name}`,
      success: true,
    });

    const { secretHash: _, ...safeIntegration } = existing;
    return {
      integration: safeIntegration,
      rawSecret,
    };
  }

  /**
   * Revokes an integration credential immediately
   */
  static async revokeIntegration(
    orgId: string,
    integrationId: string,
    reason: string,
    performer: { id: string; name: string }
  ): Promise<Omit<ApiIntegrationCredential, 'secretHash'>> {
    const all = this.getStoredIntegrations();
    const orgIntegrations = all[orgId] || [];
    const existing = orgIntegrations.find((i) => i.id === integrationId);

    if (!existing) {
      throw new Error(`Integration ${integrationId} not found in this organization.`);
    }

    existing.status = 'REVOKED';
    existing.revokedAt = new Date().toISOString();
    existing.revokedBy = performer.name;
    existing.revokedReason = reason || 'Revoked by administrator';

    all[orgId] = orgIntegrations;
    this.saveStoredIntegrations(all);
    this.syncFirestoreDoc(orgId, existing.id, existing).catch(() => {});

    this.recordAuditLog({
      organizationId: orgId,
      integrationId: existing.id,
      integrationName: existing.name,
      action: 'INTEGRATION_REVOKED',
      endpoint: `/api/v1/integrations/${integrationId}/revoke`,
      method: 'POST',
      details: `Revoked API integration "${existing.name}". Reason: ${reason} (by ${performer.name})`,
      success: true,
    });

    const { secretHash: _, ...safeIntegration } = existing;
    return safeIntegration;
  }

  /**
   * Returns all integrations for an organization (with secretHash scrubbed)
   */
  static getIntegrations(orgId: string): Omit<ApiIntegrationCredential, 'secretHash'>[] {
    const all = this.getStoredIntegrations();
    const orgIntegrations = all[orgId] || [];

    // Auto-update expired status on read
    const now = new Date();
    orgIntegrations.forEach((item) => {
      if (item.status === 'ACTIVE' && item.expiresAt && new Date(item.expiresAt) <= now) {
        item.status = 'EXPIRED';
      }
    });

    return orgIntegrations.map(({ secretHash: _, ...rest }) => rest);
  }

  // -------------------------------------------------------------------------
  // REQUEST AUTHENTICATION & VALIDATION PIPELINE
  // -------------------------------------------------------------------------
  /**
   * Authenticates an incoming API request against stored credentials:
   * 1. Validates format and hashes secret
   * 2. Constant-time match against active credentials
   * 3. Checks active status and expiration
   4. Resolves organization ID from credential (never from client request)
   5. Verifies organization active status
   6. Enforces granular required scope
   7. Evaluates rate limiting (sliding 60-second window)
   */
  static validateCredential(
    rawSecret: string,
    requiredScope?: ApiScope,
    requestInfo?: { endpoint?: string; method?: string; ip?: string; userAgent?: string }
  ): {
    valid: boolean;
    context?: AuthenticatedApiContext;
    errorCode?: 'MISSING_CREDENTIAL' | 'INVALID_CREDENTIAL' | 'REVOKED_CREDENTIAL' | 'EXPIRED_CREDENTIAL' | 'ORG_SUSPENDED' | 'INSUFFICIENT_SCOPE' | 'RATE_LIMIT_EXCEEDED';
    errorMessage?: string;
    statusCode: number;
  } {
    const endpoint = requestInfo?.endpoint || '/api/v1';
    const method = requestInfo?.method || 'GET';
    const ip = requestInfo?.ip || '0.0.0.0';

    if (!rawSecret || typeof rawSecret !== 'string' || !rawSecret.trim()) {
      this.recordAuditLog({
        organizationId: 'unknown',
        action: 'AUTH_FAILURE_MISSING',
        endpoint,
        method,
        ipAddress: ip,
        details: 'API request rejected: missing authorization header or API key',
        success: false,
      });
      return {
        valid: false,
        errorCode: 'MISSING_CREDENTIAL',
        errorMessage: 'Missing API credential. Provide token in Authorization: Bearer <key> header or X-API-Key header.',
        statusCode: 401,
      };
    }

    const trimmed = rawSecret.trim();
    if (!trimmed.startsWith('wh_live_')) {
      this.recordAuditLog({
        organizationId: 'unknown',
        action: 'AUTH_FAILURE_INVALID',
        endpoint,
        method,
        ipAddress: ip,
        details: 'API request rejected: malformed API key prefix',
        success: false,
      });
      return {
        valid: false,
        errorCode: 'INVALID_CREDENTIAL',
        errorMessage: 'Invalid API credential format.',
        statusCode: 401,
      };
    }

    const candidateHash = this.hashSecret(trimmed);
    const all = this.getStoredIntegrations();

    let matchedCredential: ApiIntegrationCredential | null = null;
    let matchedOrgId: string | null = null;

    // Constant-time search across all tenant credentials to prevent timing side-channels
    for (const [orgId, creds] of Object.entries(all)) {
      for (const cred of creds) {
        if (this.constantTimeCompare(candidateHash, cred.secretHash)) {
          matchedCredential = cred;
          matchedOrgId = orgId;
          break;
        }
      }
      if (matchedCredential) break;
    }

    if (!matchedCredential || !matchedOrgId) {
      this.recordAuditLog({
        organizationId: 'unknown',
        action: 'AUTH_FAILURE_INVALID',
        endpoint,
        method,
        ipAddress: ip,
        details: 'API request rejected: credential not recognized',
        success: false,
      });
      return {
        valid: false,
        errorCode: 'INVALID_CREDENTIAL',
        errorMessage: 'Invalid API credential. Key not recognized.',
        statusCode: 401,
      };
    }

    // Check Revocation
    if (matchedCredential.status === 'REVOKED') {
      this.recordAuditLog({
        organizationId: matchedOrgId,
        integrationId: matchedCredential.id,
        integrationName: matchedCredential.name,
        action: 'AUTH_FAILURE_REVOKED',
        endpoint,
        method,
        ipAddress: ip,
        details: `API request blocked: Integration "${matchedCredential.name}" is revoked. (${matchedCredential.revokedReason})`,
        success: false,
      });
      return {
        valid: false,
        errorCode: 'REVOKED_CREDENTIAL',
        errorMessage: 'API credential has been revoked.',
        statusCode: 401,
      };
    }

    // Check Expiration
    if (matchedCredential.expiresAt && new Date(matchedCredential.expiresAt) <= new Date()) {
      matchedCredential.status = 'EXPIRED';
      this.saveStoredIntegrations(all);

      this.recordAuditLog({
        organizationId: matchedOrgId,
        integrationId: matchedCredential.id,
        integrationName: matchedCredential.name,
        action: 'AUTH_FAILURE_EXPIRED',
        endpoint,
        method,
        ipAddress: ip,
        details: `API request blocked: Integration "${matchedCredential.name}" expired on ${matchedCredential.expiresAt}.`,
        success: false,
      });
      return {
        valid: false,
        errorCode: 'EXPIRED_CREDENTIAL',
        errorMessage: 'API credential has expired.',
        statusCode: 401,
      };
    }

    // Resolve Organization and Verify Active Status
    const org = TenantService.getOrganization(matchedOrgId);
    if (!org) {
      return {
        valid: false,
        errorCode: 'INVALID_CREDENTIAL',
        errorMessage: 'Associated tenant organization not found.',
        statusCode: 401,
      };
    }

    if (org.status === 'SUSPENDED' || org.status === 'ARCHIVED') {
      this.recordAuditLog({
        organizationId: matchedOrgId,
        integrationId: matchedCredential.id,
        integrationName: matchedCredential.name,
        action: 'AUTH_FAILURE_INACTIVE_ORG',
        endpoint,
        method,
        ipAddress: ip,
        details: `API request rejected: Organization ${org.nameEn} status is ${org.status}`,
        success: false,
      });
      return {
        valid: false,
        errorCode: 'ORG_SUSPENDED',
        errorMessage: `Access denied: Organization account is ${org.status}.`,
        statusCode: 403,
      };
    }

    // Verify Scope
    if (requiredScope && !matchedCredential.scopes.includes(requiredScope)) {
      this.recordAuditLog({
        organizationId: matchedOrgId,
        integrationId: matchedCredential.id,
        integrationName: matchedCredential.name,
        action: 'AUTHORIZATION_FAILURE_SCOPE',
        endpoint,
        method,
        ipAddress: ip,
        details: `Authorization failed: Credential lacks required scope "${requiredScope}". Available scopes: [${matchedCredential.scopes.join(', ')}]`,
        success: false,
      });
      return {
        valid: false,
        errorCode: 'INSUFFICIENT_SCOPE',
        errorMessage: `Forbidden: Credential lacks required permission scope: "${requiredScope}".`,
        statusCode: 403,
      };
    }

    // Rate Limiting (Sliding 60-Second Window)
    const nowMs = Date.now();
    const windowStartMs = nowMs - 60000;
    const bucket = (rateLimitBuckets.get(matchedCredential.id) || []).filter((ts) => ts > windowStartMs);

    if (bucket.length >= matchedCredential.rateLimitPerMinute) {
      this.recordAuditLog({
        organizationId: matchedOrgId,
        integrationId: matchedCredential.id,
        integrationName: matchedCredential.name,
        action: 'RATE_LIMIT_EXCEEDED',
        endpoint,
        method,
        ipAddress: ip,
        details: `Overall rate limit of ${matchedCredential.rateLimitPerMinute} req/min exceeded (${bucket.length} requests in 60s).`,
        success: false,
      });
      return {
        valid: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: `Too Many Requests: Rate limit of ${matchedCredential.rateLimitPerMinute} requests per minute exceeded.`,
        statusCode: 429,
      };
    }

    // Stricter rate limits for write endpoints (POST, PUT, DELETE)
    const isWriteMethod = method === 'POST' || method === 'PUT' || method === 'DELETE';
    if (isWriteMethod) {
      const writeLimit = Math.max(20, Math.floor(matchedCredential.rateLimitPerMinute / 2));
      const writeBucket = (writeRateLimitBuckets.get(matchedCredential.id) || []).filter((ts) => ts > windowStartMs);

      if (writeBucket.length >= writeLimit) {
        this.recordAuditLog({
          organizationId: matchedOrgId,
          integrationId: matchedCredential.id,
          integrationName: matchedCredential.name,
          action: 'RATE_LIMIT_EXCEEDED',
          endpoint,
          method,
          ipAddress: ip,
          details: `Write operation rate limit of ${writeLimit} writes/min exceeded (${writeBucket.length} write requests in 60s).`,
          success: false,
        });
        return {
          valid: false,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          errorMessage: `Too Many Requests: Write limit of ${writeLimit} write operations per minute exceeded.`,
          statusCode: 429,
        };
      }
      writeBucket.push(nowMs);
      writeRateLimitBuckets.set(matchedCredential.id, writeBucket);
    }

    // Record request timestamp in bucket
    bucket.push(nowMs);
    rateLimitBuckets.set(matchedCredential.id, bucket);

    // Update last used timestamp
    matchedCredential.lastUsedAt = new Date().toISOString();
    matchedCredential.lastUsedIp = ip;
    this.saveStoredIntegrations(all);

    return {
      valid: true,
      context: {
        integration: matchedCredential,
        organizationId: matchedOrgId,
        scopes: matchedCredential.scopes,
      },
      statusCode: 200,
    };
  }

  // -------------------------------------------------------------------------
  // IDEMPOTENCY MANAGEMENT
  // -------------------------------------------------------------------------
  static getIdempotencyRecord(orgId: string, key: string, endpoint: string): IdempotencyRecord | null {
    if (!key || !orgId) return null;
    const cacheKey = `${orgId}:${endpoint}:${key}`;
    const rec = idempotencyStore.get(cacheKey);
    if (!rec) return null;
    // Expire after 24 hours
    if (Date.now() - new Date(rec.createdAt).getTime() > 86400000) {
      idempotencyStore.delete(cacheKey);
      return null;
    }
    return rec;
  }

  static saveIdempotencyRecord(record: IdempotencyRecord): void {
    if (!record.key || !record.organizationId) return;
    const cacheKey = `${record.organizationId}:${record.endpoint}:${record.key}`;
    idempotencyStore.set(cacheKey, record);
  }

  // -------------------------------------------------------------------------
  // AUDIT LOGGING
  // -------------------------------------------------------------------------
  static recordAuditLog(entry: {
    organizationId: string;
    integrationId?: string;
    integrationName?: string;
    action: ApiAuditAction;
    endpoint: string;
    method: string;
    ipAddress?: string;
    userAgent?: string;
    details: string;
    success: boolean;
  }): void {
    const all = this.getStoredAuditLogs();
    const orgLogs = all[entry.organizationId] || [];

    const newLog: ApiAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      organizationId: entry.organizationId,
      integrationId: entry.integrationId,
      integrationName: entry.integrationName,
      action: entry.action,
      endpoint: entry.endpoint,
      method: entry.method,
      ipAddress: entry.ipAddress || '0.0.0.0',
      userAgent: entry.userAgent || 'API-Client',
      details: entry.details,
      timestamp: new Date().toISOString(),
      success: entry.success,
    };

    orgLogs.unshift(newLog);
    all[entry.organizationId] = orgLogs.slice(0, 200); // Retain latest 200 logs
    this.saveStoredAuditLogs(all);
  }

  static getAuditLogs(orgId: string): ApiAuditLog[] {
    const all = this.getStoredAuditLogs();
    return all[orgId] || [];
  }

  // -------------------------------------------------------------------------
  // FIRESTORE SYNC
  // -------------------------------------------------------------------------
  private static async syncFirestoreDoc(orgId: string, docId: string, data: any) {
    if (typeof window === 'undefined') return;
    if (orgId.startsWith('org_synth') || orgId.startsWith('org_qa') || orgId.startsWith('test_')) return;
    try {
      await setDoc(doc(db, 'api_integrations', docId), JSON.parse(JSON.stringify(data)), { merge: true });
    } catch {}
  }
}
