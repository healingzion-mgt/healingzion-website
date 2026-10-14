// functions/api/verify-payment.js
//
// This runs on Cloudflare's servers, not in the browser.
// It receives a payment reference from the website, checks with Paystack's
// own servers that the payment really happened, and only then updates the
// user's tier in Supabase. This closes the gap where someone could fake a
// "successful payment" message in their browser.


// Plan prices in kobo (₦1 = 100 kobo) and how long each purchase lasts.
// Monthly = 30 days, yearly = 365 days. The period is worked out from the
// amount Paystack actually confirmed, never from anything the browser says.
const PLANS = {
  growth:     { rank: 1, monthly: 500000,  yearly: 5000000 },
  enterprise: { rank: 2, monthly: 1200000, yearly: 12000000 }
};
function planFromPayment(slug, amountKobo) {
  const p = PLANS[slug];
  if (!p) return null;
  if (amountKobo >= p.yearly)  return { rank: p.rank, days: 365, period: 'yearly' };
  if (amountKobo >= p.monthly) return { rank: p.rank, days: 30,  period: 'monthly' };
  return null;
}
function expiryFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

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

    // Step 2: Work out which plan and how long it lasts, from the amount Paystack confirmed.
    const plan = planFromPayment(tierSlug, paystackData.data.amount);
    if (!plan) {
      return new Response(JSON.stringify({ error: 'Paid amount does not match any plan price for this tier.' }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const tierRank = plan.rank;

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;
    const sbHeaders = {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`
    };

    // Step 2b: The payment must belong to this account (same email), so nobody
    // can claim somebody else's payment.
    const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, { headers: sbHeaders });
    const profRows = await profRes.json();
    const profile = Array.isArray(profRows) ? profRows[0] : null;
    const payerEmail = ((paystackData.data.customer && paystackData.data.customer.email) || '').toLowerCase();
    if (!profile || !profile.email || profile.email.toLowerCase() !== payerEmail) {
      return new Response(JSON.stringify({ error: 'This payment does not belong to this account.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 2c: A payment reference can only be used once. If it was already
    // processed (for example by the webhook), just report the current plan.
    const usedRes = await fetch(`${supabaseUrl}/rest/v1/payments?paystack_ref=eq.${encodeURIComponent(reference)}&select=id`, { headers: sbHeaders });
    const used = await usedRes.json();
    if (Array.isArray(used) && used.length > 0) {
      return new Response(JSON.stringify({ success: true, tier: profile.tier, tierExpires: profile.tier_expires || null, alreadyProcessed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 3: Payment is genuinely verified. Save the plan and its end date.
    const tierExpires = expiryFromNow(plan.days);
    const patchHeaders = { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    const patchUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
    let updateRes = await fetch(patchUrl, { method: 'PATCH', headers: patchHeaders, body: JSON.stringify({ tier: tierRank, tier_expires: tierExpires }) });
    let savedExpiry = tierExpires;
    if (!updateRes.ok) {
      const errText = await updateRes.text();
      if (errText.includes('tier_expires')) {
        // The tier_expires column has not been added yet. Do not leave a paying
        // customer without access: save the plan without an end date.
        updateRes = await fetch(patchUrl, { method: 'PATCH', headers: patchHeaders, body: JSON.stringify({ tier: tierRank }) });
        savedExpiry = null;
      }
      if (!updateRes.ok) {
        const errText2 = await updateRes.text();
        return new Response(JSON.stringify({ error: 'Verified payment, but failed to update tier: ' + errText2 }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
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

    return new Response(JSON.stringify({ success: true, tier: tierRank, tierExpires: savedExpiry, period: plan.period }), {
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
