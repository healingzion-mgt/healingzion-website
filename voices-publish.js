const ADMIN_EMAIL = "oyibooyoma@gmail.com";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const id = body.id;
    const action = body.action; // "publish" or "reject"

    if (email !== ADMIN_EMAIL) {
      return jsonResponse({ ok: false, error: "Not authorized" }, 403);
    }
    if (!id || !["publish", "reject"].includes(action)) {
      return jsonResponse({ ok: false, error: "Invalid request" }, 400);
    }

    const newStatus = action === "publish" ? "published" : "rejected";
    await env.DB.prepare(`UPDATE voices SET status = ? WHERE id = ?`).bind(newStatus, id).run();

    return jsonResponse({ ok: true, status: newStatus });
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
