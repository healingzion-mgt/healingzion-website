// Share link for a guide: https://healingzion.net/g/ID
// Shows a short preview (title + teaser) in WhatsApp, then opens the website on that guide.
const SUPABASE_URL = "https://unwusufofzfbwblbjyzf.supabase.co";
const SUPABASE_KEY = "sb_publishable_xvICdxCTC3wzUYVZUOBjlw_2MvFIGwK";

export async function onRequestGet(context) {
  const id = String(context.params.id || "").replace(/[^0-9a-zA-Z-]/g, "");
  const origin = new URL(context.request.url).origin;
  const target = origin + "/resources.html#guide-" + id;

  let title = "Healingzion Resource Hub";
  let desc = "Practical guides for Nigerian entrepreneurs.";
  let tier = 0;
  try {
    const r = await fetch(
      SUPABASE_URL + "/rest/v1/guides?select=title,description,min_tier&id=eq." + encodeURIComponent(id),
      { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }
    );
    const rows = await r.json();
    if (Array.isArray(rows) && rows[0]) {
      title = rows[0].title || title;
      tier = rows[0].min_tier || 0;
      desc = rows[0].description || desc;
    }
  } catch (e) {}

  // Only a short teaser is ever put in the preview.
  desc = String(desc).replace(/\s+/g, " ").trim();
  if (desc.length > 120) desc = desc.slice(0, 117).trimEnd() + "...";
  const badge = tier === 0 ? "FREE GUIDE" : (tier === 1 ? "GROWTH GUIDE" : "ENTERPRISE GUIDE");
  const ogTitle = badge + ": " + title;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(ogTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Healingzion Management Ventures">
<meta property="og:title" content="${esc(ogTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(origin + "/g/" + id)}">
<meta property="og:image" content="${esc(origin + "/hmv-og-banner.jpg")}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body>
<p><a href="${esc(target)}">Open the guide</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

