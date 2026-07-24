const TIER_AMOUNTS_KOBO = {
  1: 500000,
  2: 3500000,
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const { reference, email, tier } = await request.json();

  if (!reference || !email || !tier) {
    return new Response(JSON.stringify({ error: 'Missing reference, email, or tier.' }), { status: 400 });
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` }
  });
  const verifyData = await verifyRes.json();

  if (!verifyData.status || verifyData.data.status !== 'success') {
    return new Response(JSON.stringify({ error: 'Payment could not be verified as successful.' }), { status: 402 });
  }

  const expectedAmount = TIER_AMOUNTS_KOBO[tier];
  if (!expectedAmount || verifyData.data.amount !== expectedAmount) {
    return new Response(JSON.stringify({ error: 'Amount paid does not match the selected tier.' }), { status: 402 });
  }

  if (verifyData.data.customer.email.toLowerCase() !== email.toLowerCase()) {
    return new Response(JSON.stringify({ error: 'Payment email does not match account email.' }), { status: 402 });
  }

  const existingPayment = await env.DB.prepare('SELECT reference FROM payments WHERE reference = ?').bind(reference).first();
  if (existingPayment) {
    return new Response(JSON.stringify({ error: 'This payment reference has already been used.' }), { status: 409 });
  }

  await env.DB.prepare('INSERT INTO payments (reference, email, tier, amount_kobo, status) VALUES (?, ?, ?, ?, ?)')
    .bind(reference, email.toLowerCase(), tier, expectedAmount, 'success').run();

  await env.DB.prepare('UPDATE users SET tier = ? WHERE email = ?')
    .bind(tier, email.toLowerCase()).run();

  return new Response(JSON.stringify({ email: email.toLowerCase(), tier }), { status: 200 });
}
