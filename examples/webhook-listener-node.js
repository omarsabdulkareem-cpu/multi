/**
 * Minimal Standalone Webhook Listener (Node.js & Express)
 * Universal Warehouse Management SaaS - Phase 14.4 Event Integration Contract
 *
 * Protocol:
 * - Signature Header: X-Warehouse-Signature (t=TIMESTAMP,v1=HMAC_SHA256)
 * - Headers: X-Warehouse-Event-Id, X-Warehouse-Event-Type, X-Warehouse-Timestamp
 * - Signing String: `${timestamp}.${rawBody}`
 * - Replay Window: 300 seconds (5 minutes)
 * - Timing-Safe Comparison: crypto.timingSafeEqual
 *
 * Run:
 *   npm install express
 *   WEBHOOK_SECRET=whsec_your_endpoint_secret node webhook-listener-node.js
 */

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_demo_secret_key_12345';

// Fast deduplication cache (In production, replace with Redis or database unique constraint)
const processedEventIds = new Set();

/**
 * Capture raw request body bytes before JSON parsing.
 * HMAC-SHA256 verification must run on the exact bytes transmitted over the network.
 */
app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signatureHeader = req.headers['x-warehouse-signature'];
    const eventId = req.headers['x-warehouse-event-id'];
    const eventType = req.headers['x-warehouse-event-type'];

    // 1. Validate presence of signature header
    if (!signatureHeader || typeof signatureHeader !== 'string') {
      console.warn('[Webhook] Rejected: Missing X-Warehouse-Signature header');
      return res.status(401).json({ error: 'Missing X-Warehouse-Signature header' });
    }

    // 2. Parse signature components: t=TIMESTAMP,v1=SIGNATURE
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((p) => p.split('='))
    );
    const timestampStr = parts.t;
    const receivedSignature = parts.v1;

    if (!timestampStr || !receivedSignature) {
      console.warn('[Webhook] Rejected: Malformed X-Warehouse-Signature format');
      return res.status(401).json({ error: 'Malformed signature header format' });
    }

    // 3. Validate timestamp tolerance window (300 seconds replay prevention)
    const now = Math.floor(Date.now() / 1000);
    const requestTimestamp = parseInt(timestampStr, 10);
    if (isNaN(requestTimestamp) || Math.abs(now - requestTimestamp) > 300) {
      console.warn(`[Webhook] Rejected: Clock drift or replay detected (${now - requestTimestamp}s drift)`);
      return res.status(401).json({ error: 'Timestamp outside tolerance window of 300s' });
    }

    // 4. Compute expected HMAC-SHA256 over `${timestamp}.${rawBody}`
    const rawBodyBuffer = req.body;
    const payloadToSign = Buffer.concat([
      Buffer.from(`${timestampStr}.`, 'utf8'),
      rawBodyBuffer,
    ]);

    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payloadToSign)
      .digest('hex');

    // 5. Timing-safe comparison to prevent side-channel timing attacks
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      console.warn('[Webhook] Rejected: Cryptographic signature mismatch');
      return res.status(401).json({ error: 'Invalid cryptographic signature' });
    }

    // 6. Parse JSON payload only AFTER signature is fully verified
    let event;
    try {
      event = JSON.parse(rawBodyBuffer.toString('utf8'));
    } catch (err) {
      console.error('[Webhook] Rejected: Malformed JSON body');
      return res.status(400).json({ error: 'Malformed JSON payload' });
    }

    // 7. Deduplicate using the stable Event ID
    const dedupeKey = eventId || event.id;
    if (processedEventIds.has(dedupeKey)) {
      console.log(`[Webhook] Idempotent duplicate received for Event ID: ${dedupeKey}. Acknowledging with 200 OK.`);
      return res.status(200).json({ received: true, deduplicated: true, eventId: dedupeKey });
    }
    processedEventIds.add(dedupeKey);

    // Keep memory cache bounded
    if (processedEventIds.size > 10000) {
      const oldestKey = processedEventIds.values().next().value;
      processedEventIds.delete(oldestKey);
    }

    // 8. Process business event
    console.log(`[Webhook] Successfully verified and received event "${event.type}" (ID: ${event.id})`);
    console.log('Payload Data:', JSON.stringify(event.data, null, 2));

    // Return HTTP 200 to confirm successful receipt
    return res.status(200).json({
      success: true,
      eventId: event.id,
      schemaVersion: event.schemaVersion,
      processedAt: new Date().toISOString(),
    });
  }
);

app.listen(PORT, () => {
  console.log(`Warehouse Webhook Receiver active at http://localhost:${PORT}/webhook`);
});
