// functions/api/verify-payment.js
//
// This runs on Cloudflare's servers, not in the browser.
// It receives a payment reference from the website, checks with Paystack's
// own servers that the payment really happened, and only then updates the
// user's tier in Supabase. This closes the gap where someone could fake a
// "successful payment" message in their browser.

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { reference, userId, tierSlug } = body;

    if (!reference || !userId || !tierSlug) {
      return new Response(JSON.stringify({ error: 'Missing reference, userId, or tierSlug' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Ask Paystack directly whether this payment reference is real and paid.
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`
      }
    });
    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status || paystackData.data.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Payment could not be verified as successful.' }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Figure out which tier this payment corresponds to, and sanity-check the amount.
    const tierRank = tierSlug === 'growth' ? 1 : (tierSlug === 'enterprise' ? 2 : null);
    const expectedAmount = tierSlug === 'growth' ? 500000 : (tierSlug === 'enterprise' ? 3500000 : null);

    if (tierRank === null) {
      return new Response(JSON.stringify({ error: 'Unrecognized tier.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (paystackData.data.amount < expectedAmount) {
      return new Response(JSON.stringify({ error: 'Paid amount does not match the required amount for this tier.' }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 3: Payment is genuinely verified — now update the user's tier in Supabase,
    // using the privileged service key (never exposed to the browser).
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;

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
      return new Response(JSON.stringify({ error: 'Verified payment, but failed to update tier: ' + errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 4: Log the payment for record-keeping (best-effort, does not block success).
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
          user_email: paystackData.data.customer.email,
          tier: tierSlug,
          amount_kobo: paystackData.data.amount,
          paystack_ref: reference,
          verified: true
        })
      });
    } catch (logErr) {
      // Logging failure should never block the actual tier upgrade from succeeding.
    }

    return new Response(JSON.stringify({ success: true, tier: tierRank }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
