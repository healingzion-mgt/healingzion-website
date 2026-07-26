// functions/api/paystack-webhook.js
//
// Paystack calls this URL directly from its own servers the moment a payment
// truly clears — completely independent of whether the customer's browser
// is still open. This is what makes tier upgrades reliable even if someone
// closes the payment popup early, loses signal, or pays via a slow method
// like bank transfer.

async function verifySignature(rawBody, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return computedHex === signature;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  const isValid = await verifySignature(rawBody, signature, env.PAYSTACK_SECRET_KEY);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // We only care about successful charges.
  if (event.event !== 'charge.success') {
    return new Response('Ignored (not a successful charge event)', { status: 200 });
  }

  const data = event.data;
  const metadata = data.metadata || {};
  const userId = metadata.userId;
  const tierSlug = metadata.tierSlug;
  const reference = data.reference;

  if (!userId || !tierSlug || !reference) {
    // Nothing we can safely act on — acknowledge so Paystack doesn't keep retrying forever.
    return new Response('Missing required metadata, ignoring', { status: 200 });
  }

  const tierRank = tierSlug === 'growth' ? 1 : (tierSlug === 'enterprise' ? 2 : null);
  const expectedAmount = tierSlug === 'growth' ? 500000 : (tierSlug === 'enterprise' ? 3500000 : null);

  if (tierRank === null || data.amount < expectedAmount) {
    return new Response('Tier or amount mismatch, ignoring', { status: 200 });
  }

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;

  // Idempotency: check whether we've already processed this exact reference.
  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/payments?paystack_ref=eq.${encodeURIComponent(reference)}&select=id`,
    {
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`
      }
    }
  );
  const existing = await existingRes.json();
  if (Array.isArray(existing) && existing.length > 0) {
    return new Response('Already processed, skipping', { status: 200 });
  }

  // Update the user's tier.
  const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ tier: tierRank })
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    return new Response('Failed to update tier: ' + errText, { status: 500 });
  }

  // Log the payment (best-effort).
  try {
    await fetch(`${supabaseUrl}/rest/v1/payments`, {
      method: 'POST',
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        user_email: data.customer.email,
        tier: tierSlug,
        amount_kobo: data.amount,
        paystack_ref: reference,
        verified: true
      })
    });
  } catch (logErr) {
    // Never let logging failures block the webhook from succeeding.
  }

  return new Response('OK', { status: 200 });
}
  
