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

class BodyInjector {
  element(element) {
    element.append(widgetHtml, { html: true });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const isGuidePage = /\/guide-[^\/]+\.html$/.test(path);
    const isAlreadyCovered = ALREADY_COVERED.includes(path);

    const response = await env.ASSETS.fetch(request);

    if (!isGuidePage || isAlreadyCovered) {
      return response;
    }

    const newHeaders = new Headers(response.headers);
    newHeaders.delete("content-length");

    const rewritten = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });

    return new HTMLRewriter()
      .on("body", new BodyInjector())
      .transform(rewritten);
  }
};
