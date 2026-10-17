export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const ALREADY_COVERED = [
    "/guide-strong-team.html",
    "/guide-cac-registration.html",
    "/guide-cac-registration-v2.html",
    "/guide-cac-mistakes-delay.html",
    "/guide-registered-your-business.html",
    "/guide-cac-3-mistakes.html",
    "/guide-cama-2020.html",
    "/guide-contracts-pack.html",
    "/guide-financial-recordkeeping.html",
    "/guide-management-systems.html",
    "/guide-managing-people.html",
    "/guide-prayer-altar.html",
    "/guide-tax-essentials.html"
  ];

  const cleanPath = path.replace(/\.html$/, "");
  const isGuidePage = /^\/guide-[^\/]+$/.test(cleanPath);
  const isResourcesHub = cleanPath === "/resources";
  const isHomepage = cleanPath === "" || cleanPath === "/" || cleanPath === "/index";
  const isAlreadyCovered = ALREADY_COVERED.some(
    (covered) => covered.replace(/\.html$/, "") === cleanPath
  );

  // ---- Paid guide protection (runs on the server, so it cannot be skipped) ----
  if (isGuidePage) {
    const blocked = await guardGuide(request, env, path);
    if (blocked) return blocked;
  }

  const response = await next();

  if ((!isGuidePage && !isResourcesHub && !isHomepage) || isAlreadyCovered) {
    return response;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const widgetHtml = `
<div id="engagementWidget" style="margin-top:30px;padding:20px;border:1px solid #24304f;border-radius:8px;background:#101a3a;font-family:Arial,sans-serif;">
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
    <button id="loveBtn" onclick="sendLove()" style="background:#101a3a;border:2px solid #d4af37;border-radius:30px;padding:8px 18px;font-size:16px;color:#f4f1ea;cursor:pointer;">
      ❤️ <span id="loveCount">0</span>
    </button>
    <span style="color:#9aa1b5;font-size:13px;">people loved this</span>
  </div>
  <div style="border-top:1px solid #24304f;padding-top:16px;">
    <div style="color:#d4af37;font-weight:bold;margin-bottom:10px;">🔔 <span id="followerCount">0</span> Followers — get notified of new guides</div>
    <div id="followFormWrap" style="display:flex;gap:8px;flex-wrap:wrap;">
      <input type="email" id="followEmail" placeholder="Your email" style="flex:1;min-width:180px;padding:10px;border-radius:5px;border:1px solid #24304f;background:#0a1128;color:#f4f1ea;">
      <button onclick="followSite()" style="background:#d4af37;color:#0a1128;border:none;border-radius:5px;padding:10px 18px;font-weight:bold;cursor:pointer;">Follow</button>
    </div>
    <div id="followMsg" style="margin-top:8px;font-size:13px;color:#7bd68a;"></div>
  </div>
</div>
<script>
const GUIDE_SLUG = window.location.pathname.split('/').pop() || 'home';
async function loadLoveCount(){try{const r=await fetch('/api/like?slug='+encodeURIComponent(GUIDE_SLUG));const d=await r.json();if(d.ok)document.getElementById('loveCount').textContent=d.love_count;}catch(e){}}
async function sendLove(){if(localStorage.getItem('loved_'+GUIDE_SLUG)){document.getElementById('loveBtn').style.opacity='0.6';return;}try{const r=await fetch('/api/like',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:GUIDE_SLUG})});const d=await r.json();if(d.ok){document.getElementById('loveCount').textContent=d.love_count;localStorage.setItem('loved_'+GUIDE_SLUG,'1');}}catch(e){}}
async function loadFollowerCount(){try{const r=await fetch('/api/follow');const d=await r.json();if(d.ok)document.getElementById('followerCount').textContent=d.follower_count;}catch(e){}}
async function followSite(){const email=document.getElementById('followEmail').value.trim();const msgEl=document.getElementById('followMsg');if(!email||!email.includes('@')){msgEl.style.color='#e07856';msgEl.textContent='Please enter a valid email.';return;}try{const r=await fetch('/api/follow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(d.ok){document.getElementById('followerCount').textContent=d.follower_count;msgEl.style.color='#7bd68a';msgEl.textContent=d.already_following?"You're already following!":"You're now following — thank you!";document.getElementById('followFormWrap').style.display='none';}else{msgEl.style.color='#e07856';msgEl.textContent=d.error||'Something went wrong.';}}catch(e){msgEl.style.color='#e07856';msgEl.textContent='Network error — try again.';}}
if(localStorage.getItem('loved_'+GUIDE_SLUG)){document.addEventListener('DOMContentLoaded',()=>{document.getElementById('loveBtn').style.opacity='0.6';});}
loadLoveCount();
loadFollowerCount();
</script>
`;

  const newResponse = new Response(response.body, response);
  newResponse.headers.delete("Content-Length");

  class BodyInjector {
    element(element) {
      element.append(widgetHtml, { html: true });
    }
  }

  return new HTMLRewriter()
    .on("body", new BodyInjector())
    .transform(newResponse);
}



const SB_URL = "https://unwusufofzfbwblbjyzf.supabase.co";
const SB_KEY = "sb_publishable_xvICdxCTC3wzUYVZUOBjlw_2MvFIGwK";

function pageHtml(title, body, status) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
    `<body style="margin:0;background:#0a1128;color:#f4f1ea;font-family:Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;">` +
    `<div style="max-width:440px;text-align:center"><h2 style="color:#d4af37">${title}</h2><p style="line-height:1.6">${body}</p>` +
    `<p><a href="/resources.html" style="display:inline-block;background:#d4af37;color:#0a1128;padding:12px 22px;border-radius:30px;font-weight:bold;text-decoration:none">Go to the Resource Hub</a></p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

function getCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

// Returns a Response to block the visitor, or null to let them in.
async function guardGuide(request, env, path) {
  const file = path.split("/").pop().replace(/\.html$/, "");
  if (!/^guide-[a-z0-9-]+$/i.test(file)) return null;
  try {
    const gr = await fetch(
      SB_URL + "/rest/v1/guides?select=id,title,min_tier&content_url=ilike." + encodeURIComponent("*" + file + "*"),
      { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } }
    );
    if (!gr.ok) return pageHtml("Please try again", "We could not check this guide right now. Please try again in a moment.", 503);
    const rows = await gr.json();
    if (!Array.isArray(rows) || rows.length === 0) return null; // not in the library: leave as is
    const need = Math.max(...rows.map(r => r.min_tier || 0));
    if (need === 0) return null; // free guide

    const label = need === 1 ? "Growth" : "Enterprise";
    const token = getCookie(request, "hz_t");
    if (!token) {
      return pageHtml("Members only", "This guide is for " + label + " members. Log in or create a free account on the Resource Hub, then choose a plan to unlock it.", 403);
    }
    const ur = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
    if (!ur.ok) {
      return pageHtml("Please log in again", "Your login has expired. Open the Resource Hub, log in, then tap View guide again.", 403);
    }
    const user = await ur.json();
    const pr = await fetch(
      SB_URL + "/rest/v1/profiles?select=tier,tier_expires&id=eq." + encodeURIComponent(user.id),
      { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } }
    );
    const prof = pr.ok ? (await pr.json())[0] : null;
    let tier = prof && prof.tier ? prof.tier : 0;
    if (tier > 0 && prof.tier_expires && new Date(prof.tier_expires).getTime() < Date.now()) tier = 0;
    if (tier >= need) return null;
    return pageHtml("Members only", "This guide is for " + label + " members. Choose a plan on the Resource Hub to unlock it.", 403);
  } catch (e) {
    return pageHtml("Please try again", "We could not check this guide right now. Please try again in a moment.", 503);
  }
      }

