// functions/api/visits.js
// Returns recent visits and daily summary counts for the admin dashboard.
// GET /api/visits           -> last 100 individual visits (time, page, location)
// GET /api/visits?summary=1 -> daily visit counts for the last 30 days

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    if (url.searchParams.get("summary") === "1") {
      const { results } = await env.DB.prepare(
        `SELECT date(visited_at) as day, COUNT(*) as visits
         FROM visits
         WHERE visited_at >= datetime('now', '-30 days')
         GROUP BY day
         ORDER BY day DESC`
      ).all();

      return new Response(JSON.stringify({ ok: true, summary: results }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const { results } = await env.DB.prepare(
      `SELECT visited_at, page, referrer, country, city, region
       FROM visits
       ORDER BY visited_at DESC
       LIMIT 100`
    ).all();

    return new Response(JSON.stringify({ ok: true, visits: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
