const ADMIN_EMAIL = "oyibooyoma@gmail.com";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { title, url, adminEmail } = body;

    if ((adminEmail || "").toLowerCase() !== ADMIN_EMAIL) {
      return jsonResponse({ ok: false, error: "Not authorized" }, 403);
    }
    if (!title || !url) {
      return jsonResponse({ ok: false, error: "Missing title or url" }, 400);
    }

    const { results } = await env.DB.prepare(`SELECT email FROM followers`).all();
    if (!results || results.length === 0) {
      return jsonResponse({ ok: true, sent: 0, message: "No followers yet" });
    }

    let sent = 0;
    let failed = 0;

    for (const row of results) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Healingzion MGT <onboarding@resend.dev>",
          to: row.email,
          subject: `New guide: ${title}`,
          html: `<p>Hi,</p><p>A new guide just went live on Healingzion Management:</p><p><strong>${title}</strong></p><p><a href="${url}">Read it here</a></p><p>— Healingzion Management</p>`
        })
      });

      if (res.ok) sent++; else failed++;
    }

    return jsonResponse({ ok: true, sent, failed, total: results.length });
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
