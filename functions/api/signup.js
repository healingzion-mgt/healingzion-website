async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { email, password } = await request.json();

  if (!email || !password || password.length < 6) {
    return new Response(JSON.stringify({ error: 'Enter a valid email and a password of at least 6 characters.' }), { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await env.DB.prepare('SELECT email FROM users WHERE email = ?').bind(normalizedEmail).first();
  if (existing) {
    return new Response(JSON.stringify({ error: 'An account with this email already exists.' }), { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  await env.DB.prepare('INSERT INTO users (email, password_hash, tier) VALUES (?, ?, 0)')
    .bind(normalizedEmail, passwordHash).run();

  return new Response(JSON.stringify({ email: normalizedEmail, tier: 0 }), { status: 200 });
}
