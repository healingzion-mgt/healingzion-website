// functions/api/track.js
// Logs a page visit: timestamp (auto), page, referrer, and approximate location
// Location comes from Cloudflare's request.cf object — no external service needed,
// no cookies, no personal data beyond approximate city/region/country.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const page = (body.page || "/").slice(0, 300);
    const referrer = (body.referrer || "").slice(0, 300);

    const cf = request.cf || {};
    const country = cf.country || null;
    const city = cf.city || null;
    const region = cf.region || null;

    await env.DB.prepare(
      `INSERT INTO visits (page, referrer, country, city, region) VALUES (?, ?, ?, ?, ?)`
    ).bind(page, referrer, country, city, region).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
