// One like per device per post (tracked by a hashed IP + browser fingerprint).
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const id = parseInt(body.id, 10);
    if (!id) {
      return jsonResponse({ ok: false, error: "Missing post id" }, 400);
    }

    let already = false;
    try {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS likes (post_id INTEGER NOT NULL, voter TEXT NOT NULL, UNIQUE(post_id, voter))`
      ).run();
      const voter = await voterKey(request);
      const ins = await env.DB.prepare(
        `INSERT OR IGNORE INTO likes (post_id, voter) VALUES (?, ?)`
      ).bind(id, voter).run();
      const added = ins.meta && ins.meta.changes > 0;
      if (added) {
        await env.DB.prepare(`UPDATE posts SET like_count = like_count + 1 WHERE id = ?`).bind(id).run();
      } else {
        already = true;
      }
    } catch (e) {
      // If the likes table cannot be used, fall back to the simple count.
      await env.DB.prepare(`UPDATE posts SET like_count = like_count + 1 WHERE id = ?`).bind(id).run();
    }

    const row = await env.DB.prepare(`SELECT like_count FROM posts WHERE id = ?`).bind(id).first();
    return jsonResponse({ ok: true, like_count: row ? row.like_count : 0, already: already });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

async function voterKey(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "";
  const data = new TextEncoder().encode(ip + "|" + ua);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
