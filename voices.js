const ADMIN_EMAIL = "oyibooyoma@gmail.com";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  const isAdminRequest = email && email === ADMIN_EMAIL;

  const query = isAdminRequest
    ? `SELECT id, name, message, status, created_at FROM voices ORDER BY created_at DESC`
    : `SELECT id, name, message, created_at FROM voices WHERE status = 'published' ORDER BY created_at DESC`;

  const { results } = await env.DB.prepare(query).all();
  return jsonResponse({ ok: true, voices: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const message = (body.message || "").trim();

    if (!name || !message) {
      return jsonResponse({ ok: false, error: "Please fill in your name and message" }, 400);
    }
    if (message.length > 1000) {
      return jsonResponse({ ok: false, error: "Message is too long" }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO voices (name, message, status) VALUES (?, ?, 'pending')`
    ).bind(name, message).run();

    return jsonResponse({ ok: true, submitted: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
