async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Enter your email and password.' }), { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await env.DB.prepare('SELECT email, password_hash, tier FROM users WHERE email = ?')
    .bind(normalizedEmail).first();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Incorrect email or password.' }), { status: 401 });
  }

  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.password_hash) {
    return new Response(JSON.stringify({ error: 'Incorrect email or password.' }), { status: 401 });
  }

  return new Response(JSON.stringify({ email: user.email, tier: user.tier }), { status: 200 });
}
