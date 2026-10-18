# Universal Warehouse Management SaaS
## Webhooks & Outbound Event Delivery Integration Guide (Phase 14.4)

Version: `2026-10-01`  
Protocol: `HMAC-SHA256`  
Security Standard: Zero-Trust SSRF, DNS Rebinding Guard, Non-Blocking Outbox

---

### Table of Contents
1. [Architecture Overview & Delivery Guarantees](#1-architecture-overview--delivery-guarantees)
2. [Event Envelope & Schema Specification](#2-event-envelope--schema-specification)
3. [Supported Business Event Catalog](#3-supported-business-event-catalog)
4. [HTTP Request Headers](#4-http-request-headers)
5. [Cryptographic HMAC-SHA256 Signature Verification](#5-cryptographic-hmac-sha256-signature-verification)
6. [Consumer Deduplication & Idempotency](#6-consumer-deduplication--idempotency)
7. [HTTP Response Expectations & Error Codes](#7-http-response-expectations--error-codes)
8. [Retry Policy, Exponential Backoff & Jitter](#8-retry-policy-exponential-backoff--jitter)
9. [Destination URL Security & SSRF Protection](#9-destination-url-security--ssrf-protection)
10. [Secret Management & Zero-Downtime Rotation](#10-secret-management--zero-downtime-rotation)
11. [Complete Receiver Examples](#11-complete-receiver-examples)
    - [Node.js / Express](#nodejs--express-receiver-example)
    - [Python / FastAPI](#python--fastapi-receiver-example)
12. [Troubleshooting & Diagnostics](#12-troubleshooting--diagnostics)
13. [Production Deployment Prerequisites](#13-production-deployment-prerequisites)

---

### 1. Architecture Overview & Delivery Guarantees

The Universal Warehouse Management platform provides real-time event streaming when authoritative warehouse operations (goods receipt, issue, transfer, inventory adjustment, stock count, and catalog changes) reach confirmed ledger states.

#### Key Principles:
- **At-Least-Once Delivery**: Outbound webhook delivery operates under an at-least-once model. Transient network partitions, socket resets, or listener delays may cause re-delivery. Consumers **must deduplicate** using the stable `id` (Event ID) field.
- **Strict Decoupling from Warehouse Transactions**: Outbound event delivery runs asynchronously. A network failure, timeout, or destination error **never** reverts, locks, or rolls back confirmed inventory ledger entries.
- **Zero-Trust Security**: Every outbound delivery is signed using an endpoint-specific high-entropy secret (`whsec_...`) and validated against server-side DNS rebinding and SSRF restrictions before any socket connection is formed.
- **Tenant Isolation**: Webhook endpoints and delivery logs are strictly partitioned by organization ID (`org_*`). Cross-tenant access is prohibited at both the API and database layers.

---

### 2. Event Envelope & Schema Specification

All events follow the standardized Phase 14.4 versioned envelope (`schemaVersion: "2026-10-01"`):

```json
{
  "id": "evt_inventory_receipt_confirmed_GRN-101",
  "type": "inventory.receipt.confirmed",
  "schemaVersion": "2026-10-01",
  "occurredAt": "2026-10-18T10:15:30.000Z",
  "organizationId": "org_alkarwan",
  "data": {
    "transactionId": "tx_gr_948271",
    "receiptId": "rec_091823",
    "receiptNumber": "GRN-101",
    "warehouseId": "wh_main_central",
    "warehouseName": "Central Storage Warehouse",
    "supplierName": "Petrochemical Plastics Supplier Ltd",
    "totalQuantity": 500,
    "totalWeightKG": 12500,
    "linesCount": 2,
    "confirmedAt": "2026-10-18T10:15:30.000Z",
    "lines": [
      {
        "itemId": "mat_hdpe_natural",
        "itemCode": "HDPE-5502",
        "itemName": "HDPE Natural Pellets",
        "quantity": 300,
        "unit": "Bags (25kg)",
        "weightKG": 7500,
        "batchId": "BATCH-2026-10-A",
        "locationId": "BIN-A-01"
      },
      {
        "itemId": "mat_pp_copolymer",
        "itemCode": "PP-4100",
        "itemName": "Polypropylene Copolymer",
        "quantity": 200,
        "unit": "Bags (25kg)",
        "weightKG": 5000,
        "batchId": "BATCH-2026-10-B",
        "locationId": "BIN-B-04"
      }
    ]
  }
}
```

#### Envelope Fields:
| Field | Type | Description |
|---|---|---|
| `id` | `string` | Deterministic, unique event identifier (e.g. `evt_type_documentNumber`). Used by listeners for idempotent deduplication. |
| `type` | `string` | Qualified event name from the supported event catalog. |
| `schemaVersion` | `string` | Immutable schema contract version (`"2026-10-01"`). |
| `occurredAt` | `string` | ISO-8601 timestamp when the business transaction was confirmed. |
| `organizationId` | `string` | Authoritative organization/tenant boundary. |
| `data` | `object` | Domain-specific payload containing transaction IDs, warehouse IDs, quantities, and line items. |

---

### 3. Supported Business Event Catalog

| Event Type | Category | Description |
|---|---|---|
| `inventory.receipt.confirmed` | `INVENTORY` | Emitted when an inbound goods receipt is confirmed and inventory ledger is credited. |
| `inventory.issue.confirmed` | `INVENTORY` | Emitted when outbound materials are authorized, stock availability verified, and quantities deducted. |
| `inventory.transfer.completed` | `INVENTORY` | Emitted when an inter-warehouse or inter-bin transfer movement is committed to the ledger. |
| `inventory.adjustment.confirmed` | `INVENTORY` | Emitted when an audited inventory variance adjustment is approved and ledger adjusted. |
| `inventory.return.confirmed` | `INVENTORY` | Emitted when customer or production returns are credited back into inventory. |
| `inventory.stocktake.completed` | `INVENTORY` | Emitted when a physical stock count session is completed and variance ledger sealed. |
| `purchase_order.approved` | `PURCHASING` | Emitted when a draft purchase order reaches management approval. |
| `purchase_order.received` | `PURCHASING` | Emitted when supplier deliveries fulfill order lines into stock. |
| `item.created` | `CATALOG` | Emitted when a new raw material, packaging, or product SKU is registered. |
| `item.updated` | `CATALOG` | Emitted when item specifications, weights, or categories are updated. |
| `warehouse.created` | `CATALOG` | Emitted when a new physical storage warehouse is provisioned. |
| `integration.test` | `SYSTEM` | Ping event to verify listener connectivity and cryptographic HMAC signature validation without altering warehouse balances. |

---

### 4. HTTP Request Headers

Outbound requests include the following diagnostic and security headers:

| Header Name | Format Example | Purpose |
|---|---|---|
| `X-Warehouse-Event-Id` | `evt_inventory_receipt_confirmed_GRN-101` | Unique event identifier for receiver deduplication. |
| `X-Warehouse-Event-Type` | `inventory.receipt.confirmed` | Type of event being transmitted. |
| `X-Warehouse-Delivery-Id` | `del_9ea9bc2bd7380e0e` | Outbox attempt identifier for tracing delivery logs. |
| `X-Warehouse-Timestamp` | `1792344021` | Unix epoch timestamp (seconds) when delivery was signed. |
| `X-Warehouse-Signature` | `t=1792344021,v1=bebcaa2fcc5ac4...` | HMAC-SHA256 signature calculated over `${timestamp}.${rawBody}`. |
| `Content-Type` | `application/json` | JSON content type. |
| `User-Agent` | `Universal-Warehouse-Webhooks/1.0` | Client user agent identifier. |

---

### 5. Cryptographic HMAC-SHA256 Signature Verification

To prevent request tampering and replay attacks:

1. **Extract Signature Components**:
   Parse `X-Warehouse-Signature` into timestamp `t` and signature `v1`:
   ```
   X-Warehouse-Signature: t=1792344021,v1=5d41402abc4b2a76b9719d911017c592...
   ```
2. **Validate Timestamp Window (Replay Protection)**:
   Compare the timestamp `t` against your server's current time. Reject any request where:
   $$|\text{currentTime} - t| > 300\text{ seconds (5 minutes)}$$
3. **Construct Payload to Sign**:
   Concatenate the timestamp string, a period (`.`), and the exact raw HTTP request body bytes:
   ```
   payloadToSign = `${t}.${rawBody}`
   ```
   **CRITICAL**: You must use the exact raw bytes received from the network. Do not re-serialize or parse JSON before computing the signature!
4. **Compute HMAC-SHA256**:
   Calculate HMAC-SHA256 of `payloadToSign` using your endpoint's signing secret (`whsec_...`) and format the result as a lowercase hexadecimal string.
5. **Constant-Time Comparison**:
   Compare the computed digest with the received `v1` value using a constant-time comparison function (e.g. `crypto.timingSafeEqual` in Node.js or `hmac.compare_digest` in Python) to prevent side-channel timing attacks.

---

### 6. Consumer Deduplication & Idempotency

Network timeouts or server retries may cause the same event to be delivered more than once.
- Always store processed `X-Warehouse-Event-Id` values in a fast database or key-value store (e.g. Redis, PostgreSQL table with a `UNIQUE` constraint).
- When receiving a request, check if `X-Warehouse-Event-Id` has already been processed:
  - If **already processed**: Return HTTP `200 OK` immediately without reprocessing business logic.
  - If **new**: Process the event inside a database transaction, mark the Event ID as processed, and return HTTP `200 OK`.

---

### 7. HTTP Response Expectations & Error Codes

The platform delivery engine interprets listener HTTP response codes as follows:

| Response Code | Interpretation | Engine Action |
|---|---|---|
| `200` - `299` | **Successful Delivery** | Delivery marked as `succeeded`. No further retries. |
| `408`, `429` | **Transient Rate Limit / Timeout** | Delivery marked as `retrying`. Re-enqueued with exponential backoff & jitter. |
| `500`, `502`, `503`, `504` | **Transient Server Error** | Delivery marked as `retrying`. Re-enqueued with exponential backoff & jitter. |
| `400`, `401`, `403`, `404`, `422` | **Terminal Client Error** | Delivery marked as `failed`. **No automatic retry** (requires endpoint or payload inspection). |
| Socket Timeout / Network Reset | **Connection Failure** | Delivery marked as `retrying`. Re-enqueued with exponential backoff & jitter. |
| SSRF / DNS Block | **Security Policy Violation** | Delivery marked as `failed` immediately. Outbound connection aborted. |

---

### 8. Retry Policy, Exponential Backoff & Jitter

When transient failures occur, delivery is scheduled using truncated exponential backoff with full jitter to avoid the thundering herd problem:

$$\text{delay} = \min\left(M, B \times 2^{\text{attempt}-1}\right) + \text{jitter}$$

- **Base Backoff ($B$)**: 1,000 ms (1 second)
- **Max Backoff ($M$)**: 300,000 ms (5 minutes)
- **Max Automatic Attempts**: 5 attempts
- **Connection Timeout**: 5,000 ms (5 seconds)
- **Response Size Cap**: 16,384 bytes (16 KB)
- **Redirects**: Disallowed (HTTP 301, 302, 307, 308 are blocked immediately to prevent redirect SSRF).

---

### 9. Destination URL Security & SSRF Protection

All registered webhook destinations must satisfy strict zero-trust security requirements:

- **HTTPS Protocol Only**: Plaintext `http://`, `file:`, `ftp:`, and custom schemas are rejected.
- **Port Restriction**: Only standard HTTPS port `443` is allowed.
- **No Embedded Credentials**: URLs with `username:password@host` are rejected.
- **Fully Qualified Domain Names**: Single-label hosts (`localhost`, `intranet`, `router`) are rejected.
- **Prohibited Address Ranges**: Hostnames resolving to any of the following are blocked at socket connection time:
  - IPv4 Loopback (`127.0.0.0/8`)
  - IPv4 Private Networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - Carrier-Grade NAT (`100.64.0.0/10`)
  - Link-Local & Cloud Metadata (`169.254.0.0/16`, including AWS/GCP/Azure `169.254.169.254`)
  - Broadcast & Multicast (`224.0.0.0/4`, `255.255.255.255`)
  - IPv6 Loopback (`::1`), Link-Local (`fe80::/10`), Unique Local (`fc00::/7`), and IPv4-mapped IPv6 (`::ffff:127.0.0.1`).
- **DNS Rebinding Defense**: DNS resolution is performed and pinned immediately before socket creation. If a hostname resolves to both public and private addresses, the request is blocked.

---

### 10. Secret Management & Zero-Downtime Rotation

Each webhook endpoint is assigned a cryptographically random, high-entropy signing secret (`whsec_...`).

- **One-Time Plaintext Disclosure**: The raw secret is displayed once in the management UI upon creation or rotation. Store it immediately in a secure vault (e.g. Google Secret Manager, AWS Secrets Manager, or environment variables).
- **Zero Raw Secret Persistence**: The platform never stores raw secrets in ordinary logs, endpoint listings, or delivery history.
- **Secret Rotation**: When rotating secrets:
  1. The server immediately generates a new secret and invalidates the previous secret.
  2. The new secret is revealed once in the UI.
  3. Update your listener application with the new secret to maintain verification.

---

### 11. Complete Receiver Examples

#### Node.js / Express Receiver Example

```javascript
/**
 * Production-ready Express Webhook Listener
 * Dependencies: express
 * Run: npm install express
 */
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Set your webhook signing secret from environment variable
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_your_endpoint_secret_here';

// In-memory set for event deduplication (use Redis / DB in multi-instance production)
const processedEvents = new Set();

/**
 * Capture raw request body bytes for HMAC-SHA256 signature verification.
 * CRITICAL: Verification MUST be computed on the exact raw bytes!
 */
app.post(
  '/api/warehouse-webhooks',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sigHeader = req.headers['x-warehouse-signature'];
    const eventId = req.headers['x-warehouse-event-id'];
    const eventType = req.headers['x-warehouse-event-type'];

    if (!sigHeader) {
      console.warn('[Webhook] Missing X-Warehouse-Signature header');
      return res.status(401).json({ error: 'Missing signature header' });
    }

    // 1. Parse signature components
    const parts = Object.fromEntries(
      sigHeader.split(',').map((p) => p.split('='))
    );
    if (!parts.t || !parts.v1) {
      console.warn('[Webhook] Malformed signature header format');
      return res.status(401).json({ error: 'Malformed signature header' });
    }

    // 2. Enforce 300-second replay tolerance window
    const nowSeconds = Math.floor(Date.now() / 1000);
    const requestTimestamp = parseInt(parts.t, 10);
    if (isNaN(requestTimestamp) || Math.abs(nowSeconds - requestTimestamp) > 300) {
      console.warn('[Webhook] Stale timestamp detected (possible replay attack)');
      return res.status(401).json({ error: 'Timestamp outside 300s tolerance window' });
    }

    // 3. Compute expected HMAC-SHA256 signature
    const rawBodyBuffer = req.body;
    const payloadToSign = Buffer.concat([
      Buffer.from(`${parts.t}.`, 'utf8'),
      rawBodyBuffer,
    ]);

    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payloadToSign)
      .digest('hex');

    // 4. Constant-time comparison to prevent timing attacks
    const receivedSignatureBuffer = Buffer.from(parts.v1, 'hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
      !crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
    ) {
      console.warn('[Webhook] Signature verification failed');
      return res.status(401).json({ error: 'Invalid cryptographic signature' });
    }

    // 5. Parse JSON payload only AFTER successful verification
    let event;
    try {
      event = JSON.parse(rawBodyBuffer.toString('utf8'));
    } catch (err) {
      console.error('[Webhook] JSON parse error:', err.message);
      return res.status(400).json({ error: 'Malformed JSON payload' });
    }

    // 6. Consumer-side idempotency deduplication
    const dedupeKey = eventId || event.id;
    if (processedEvents.has(dedupeKey)) {
      console.log(`[Webhook] Duplicate event "${dedupeKey}" skipped (idempotent ACK)`);
      return res.status(200).json({ received: true, deduplicated: true });
    }
    processedEvents.add(dedupeKey);

    // Keep deduplication set bounded in memory
    if (processedEvents.size > 10000) {
      const oldest = processedEvents.values().next().value;
      processedEvents.delete(oldest);
    }

    // 7. Route business logic based on event type
    console.log(`[Webhook] Processing verified event: ${event.type} (ID: ${event.id})`);
    switch (event.type) {
      case 'inventory.receipt.confirmed':
        console.log(` -> Goods Receipt ${event.data.receiptNumber}: ${event.data.totalWeightKG} KG credited.`);
        break;

      case 'inventory.issue.confirmed':
        console.log(` -> Stock Issue ${event.data.issueNumber}: ${event.data.totalWeightKG} KG deducted.`);
        break;

      case 'inventory.transfer.completed':
        console.log(` -> Transfer ${event.data.transferNumber}: Source ${event.data.sourceWarehouseId} -> Dest ${event.data.destinationWarehouseId}`);
        break;

      case 'inventory.adjustment.confirmed':
        console.log(` -> Adjustment ${event.data.adjustmentId}: Item ${event.data.itemCode} Delta: ${event.data.quantityDelta}`);
        break;

      case 'integration.test':
        console.log(` -> Ping test event received successfully: ${event.data.message}`);
        break;

      default:
        console.log(` -> Unhandled event type: ${event.type}`);
    }

    // Return 200 OK to acknowledge successful processing
    return res.status(200).json({ success: true, eventId: event.id });
  }
);

app.listen(PORT, () => {
  console.log(`Warehouse Webhook Receiver listening on port ${PORT}`);
});
```

---

#### Python / FastAPI Receiver Example

```python
"""
Production-ready FastAPI Webhook Listener
Dependencies: fastapi, uvicorn
Run: pip install fastapi uvicorn && uvicorn main:app --port 8080
"""
import os
import time
import hmac
import hashlib
import json
from fastapi import FastAPI, Request, Response, status

app = FastAPI(title="Warehouse Webhook Receiver")

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "whsec_your_endpoint_secret_here")

# In-memory deduplication set (replace with Redis in multi-worker deployments)
processed_events = set()

@app.post("/api/warehouse-webhooks")
async def receive_warehouse_webhook(request: Request):
    # 1. Retrieve required headers
    sig_header = request.headers.get("x-warehouse-signature")
    event_id = request.headers.get("x-warehouse-event-id")
    event_type = request.headers.get("x-warehouse-event-type")

    if not sig_header:
        return Response(content='{"error":"Missing X-Warehouse-Signature header"}', 
                        status_code=status.HTTP_401_UNAUTHORIZED, media_type="application/json")

    # 2. Parse signature components
    try:
        parts = dict(item.split("=", 1) for item in sig_header.split(","))
        timestamp_str = parts["t"]
        received_signature = parts["v1"]
    except Exception:
        return Response(content='{"error":"Malformed signature header"}', 
                        status_code=status.HTTP_401_UNAUTHORIZED, media_type="application/json")

    # 3. Enforce 300-second replay tolerance window
    now = int(time.time())
    try:
        request_time = int(timestamp_str)
        if abs(now - request_time) > 300:
            return Response(content='{"error":"Timestamp outside 300s tolerance window"}', 
                            status_code=status.HTTP_401_UNAUTHORIZED, media_type="application/json")
    except ValueError:
        return Response(content='{"error":"Invalid timestamp"}', 
                        status_code=status.HTTP_401_UNAUTHORIZED, media_type="application/json")

    # 4. Read raw request body bytes BEFORE JSON parsing
    raw_body = await request.body()

    # 5. Compute HMAC-SHA256 signature
    payload_to_sign = f"{timestamp_str}.".encode("utf-8") + raw_body
    computed_signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload_to_sign,
        hashlib.sha256
    ).hexdigest()

    # 6. Constant-time comparison
    if not hmac.compare_digest(computed_signature, received_signature):
        return Response(content='{"error":"Invalid cryptographic signature"}', 
                        status_code=status.HTTP_401_UNAUTHORIZED, media_type="application/json")

    # 7. Parse JSON only AFTER verification
    try:
        event = json.loads(raw_body.decode("utf-8"))
    except Exception:
        return Response(content='{"error":"Invalid JSON"}', 
                        status_code=status.HTTP_400_BAD_REQUEST, media_type="application/json")

    # 8. Idempotent Deduplication
    dedupe_key = event_id or event.get("id")
    if dedupe_key in processed_events:
        return {"received": True, "deduplicated": True}
    
    processed_events.add(dedupe_key)
    if len(processed_events) > 10000:
        processed_events.pop()

    # 9. Handle business operations
    print(f"[Webhook Verified] Received event {event.get('type')} (ID: {event.get('id')})")
    
    return {"success": True, "eventId": event.get("id")}
```

---

### 12. Troubleshooting & Diagnostics

| Symptom | Cause | Solution |
|---|---|---|
| `SSRF Blocked: Destination resolved to prohibited IP address` | Destination URL points to private IP (`10.*`, `192.168.*`, `127.*`, or metadata IP). | Use a public FQDN with valid HTTPS. |
| `Timestamp outside tolerance window of 300s` | Clock drift on listener server or replayed request. | Synchronize server clock via NTP. |
| `Invalid cryptographic signature` | Secret mismatch, wrong secret used, or body was modified by JSON middleware before signing check. | Ensure receiver uses raw body bytes and the latest rotated secret (`whsec_...`). |
| `Connection timeout after 5000ms` | Receiver server took too long to respond or network route blocked. | Process events asynchronously in the receiver and return HTTP 200 within 2 seconds. |
| `Redirects not followed (HTTP 301/302)` | Webhook destination URL responded with a redirect. | Configure endpoint with final canonical HTTPS URL. |

---

### 13. Production Deployment Prerequisites

For full production deployment:
1. **Node.js Production Runtime**: Dev server or Express production server running with TLS egress capability.
2. **Environment Secret Key**: Set `WEBHOOK_SECRET_KEY` or `WEBHOOK_SALT` in your container environment variables (an automatic cryptographic fallback is initialized if unset).
3. **Database Persistence**: Firestore rules deployed (`firestore.rules`) with persistent outbox collection `webhook_deliveries` and `webhook_endpoints`.
4. **Outbound Port 443 Egress**: Cloud Run / container network firewall must permit egress connections to external HTTPS listeners on port 443.
