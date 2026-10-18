"""
Minimal Standalone Webhook Listener (Python & FastAPI)
Universal Warehouse Management SaaS - Phase 14.4 Event Integration Contract

Protocol:
- Signature Header: X-Warehouse-Signature (t=TIMESTAMP,v1=HMAC_SHA256)
- Headers: X-Warehouse-Event-Id, X-Warehouse-Event-Type, X-Warehouse-Timestamp
- Signing String: f"{timestamp}.{rawBody}"
- Replay Window: 300 seconds (5 minutes)
- Timing-Safe Comparison: hmac.compare_digest

Run:
  pip install fastapi uvicorn
  WEBHOOK_SECRET=whsec_your_endpoint_secret uvicorn webhook-listener-python:app --port 8080
"""

import os
import time
import hmac
import hashlib
import json
from fastapi import FastAPI, Request, Response, status

app = FastAPI(title="Warehouse Webhook Receiver Example")

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "whsec_demo_secret_key_12345")

# Fast in-memory deduplication set (in multi-instance production, use Redis or SQL table)
processed_event_ids = set()


@app.post("/webhook")
async def receive_webhook(request: Request):
    # 1. Retrieve required headers
    signature_header = request.headers.get("x-warehouse-signature")
    event_id = request.headers.get("x-warehouse-event-id")
    event_type = request.headers.get("x-warehouse-event-type")

    if not signature_header:
        return Response(
            content=json.dumps({"error": "Missing X-Warehouse-Signature header"}),
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json",
        )

    # 2. Parse signature components: t=TIMESTAMP,v1=SIGNATURE
    try:
        parts = dict(kv.split("=", 1) for kv in signature_header.split(","))
        timestamp_str = parts["t"]
        received_signature = parts["v1"]
    except Exception:
        return Response(
            content=json.dumps({"error": "Malformed X-Warehouse-Signature format"}),
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json",
        )

    # 3. Validate timestamp tolerance window (300 seconds)
    now = int(time.time())
    try:
        request_timestamp = int(timestamp_str)
        if abs(now - request_timestamp) > 300:
            return Response(
                content=json.dumps({"error": "Timestamp outside tolerance window of 300s"}),
                status_code=status.HTTP_401_UNAUTHORIZED,
                media_type="application/json",
            )
    except ValueError:
        return Response(
            content=json.dumps({"error": "Invalid timestamp format"}),
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json",
        )

    # 4. Read raw request body bytes BEFORE JSON parsing
    raw_body = await request.body()

    # 5. Compute HMAC-SHA256 signature over f"{timestamp}.{raw_body}"
    payload_to_sign = f"{timestamp_str}.".encode("utf-8") + raw_body
    computed_signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload_to_sign,
        hashlib.sha256,
    ).hexdigest()

    # 6. Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(computed_signature, received_signature):
        return Response(
            content=json.dumps({"error": "Invalid cryptographic signature"}),
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json",
        )

    # 7. Parse JSON body only AFTER signature is verified
    try:
        event = json.loads(raw_body.decode("utf-8"))
    except Exception:
        return Response(
            content=json.dumps({"error": "Malformed JSON payload"}),
            status_code=status.HTTP_400_BAD_REQUEST,
            media_type="application/json",
        )

    # 8. Idempotent Deduplication using Event ID
    dedupe_key = event_id or event.get("id")
    if dedupe_key in processed_event_ids:
        print(f"[Webhook] Idempotent duplicate: {dedupe_key}. Acknowledging with 200 OK.")
        return {"received": True, "deduplicated": True, "eventId": dedupe_key}

    processed_event_ids.add(dedupe_key)
    if len(processed_event_ids) > 10000:
        processed_event_ids.pop()

    # 9. Handle domain event
    print(f"[Webhook Verified] Event: {event.get('type')} (ID: {event.get('id')})")
    print(f"Data: {json.dumps(event.get('data', {}), indent=2)}")

    return {
        "success": True,
        "eventId": event.get("id"),
        "schemaVersion": event.get("schemaVersion"),
        "processedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
