// Our Family — frontend configuration
// Paste your Supabase Project URL and Publishable key below.
// Never put a Supabase secret/service_role key in this file.
const SUPABASE_URL = "https://yqwqddbvbfdabfzyyvyx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Z3Bi4BtVz7iHhOe4ONCTzg_a04Rld38";

const configured = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PASTE_") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");

const $ = (id) => document.getElementById(id);
const views = ["authView","pendingView","familyView"];
let supabase = null;
let currentUser = null;
let currentProfile = null;

function showMessage(id, message, isError=false) {
  const el = $(id); el.textContent = message; el.classList.toggle("error", isError);
}
function showView(view) {
  views.forEach(id => $(id).classList.toggle("hidden", id !== view));
  $("logoutBtn").classList.toggle("hidden", !currentUser);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function formatDate(value) {
  return new Date(value).toLocaleString([], {dateStyle:"medium", timeStyle:"short"});
}

function setAuthTab(tab) {
  const login = tab === "login";
  $("loginForm").classList.toggle("hidden", !login);
  $("signupForm").classList.toggle("hidden", login);
  $("loginTab").classList.toggle("active", login);
  $("signupTab").classList.toggle("active", !login);
  showMessage("authMessage","");
}
$("loginTab").addEventListener("click", () => setAuthTab("login"));
$("signupTab").addEventListener("click", () => setAuthTab("signup"));

async function start() {
  if (!configured || !window.supabase) {
    $("setupNotice").classList.remove("hidden");
    showView("authView");
    return;
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const {data:{session}} = await supabase.auth.getSession();
  if (session) { currentUser = session.user; await loadProfileAndApp(); }
  else showView("authView");

  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(async () => {
      currentUser = session?.user ?? null;
      if (currentUser) await loadProfileAndApp();
      else { currentProfile = null; showView("authView"); }
    }, 0);
  });
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); showMessage("authMessage","Signing in…");
  const {error} = await supabase.auth.signInWithPassword({
    email:$("loginEmail").value.trim(), password:$("loginPassword").value
  });
  if (error) showMessage("authMessage",error.message,true);
});
$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault(); showMessage("authMessage","Sending your access request…");
  const {data,error} = await supabase.auth.signUp({
    email:$("signupEmail").value.trim(),
    password:$("signupPassword").value,
    options:{data:{full_name:$("signupName").value.trim()}}
  });
  if (error) return showMessage("authMessage",error.message,true);
  if (data.session) {
    currentUser = data.user; await loadProfileAndApp();
  } else {
    showMessage("authMessage","Request created. Check your email if confirmation is enabled. You can sign in after confirming; the admin still needs to approve access.");
  }
});
async function logout() { await supabase.auth.signOut(); currentUser=null; currentProfile=null; showView("authView"); }
$("logoutBtn").addEventListener("click",logout);
$("pendingLogoutBtn").addEventListener("click",logout);

async function loadProfileAndApp() {
  const {data:profile,error} = await supabase.from("profiles")
    .select("id,full_name,role,approved").eq("id",currentUser.id).maybeSingle();
  if (error || !profile) {
    showView("pendingView");
    return;
  }
  currentProfile = profile;
  if (!profile.approved) { showView("pendingView"); return; }
  showView("familyView");
  $("helloText").textContent = `Hello, ${profile.full_name || "Family member"}. Here's what's happening at home.`;
  const isAdmin = profile.role === "admin";
  $("rolePill").textContent = isAdmin ? "ADMIN" : "FAMILY MEMBER";
  $("adminPanel").classList.toggle("hidden",!isAdmin);
  $("composePanel").classList.toggle("hidden",!isAdmin);
  if (isAdmin) await loadMembers();
  await loadFeed();
}

async function loadMembers() {
  const {data,error} = await supabase.from("profiles")
    .select("id,full_name,role,approved,created_at")
    .neq("id",currentUser.id).order("created_at",{ascending:true});
  if (error) { $("memberList").textContent = "Could not load members: " + error.message; return; }
  const pending = (data||[]).filter(p => !p.approved && p.role !== "admin");
  $("pendingCount").textContent = String(pending.length);
  if (!data?.length) { $("memberList").innerHTML = '<p class="muted small">No other family accounts yet.</p>'; return; }
  $("memberList").innerHTML = data.map(p => `
    <div class="member-row">
      <div class="member-info"><strong>${escapeHtml(p.full_name || "Family member")}</strong>
        <small>${p.approved ? "Approved member" : "Waiting for approval"}</small></div>
      <div class="member-actions">
        ${p.approved
          ? `<button class="secondary" data-action="revoke" data-id="${escapeHtml(p.id)}">Revoke access</button>`
          : `<button class="primary" data-action="approve" data-id="${escapeHtml(p.id)}">Approve</button>
             <button class="secondary" data-action="reject" data-id="${escapeHtml(p.id)}">Keep pending</button>`}
      </div>
    </div>`).join("");
  $("memberList").querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id=btn.dataset.id, action=btn.dataset.action;
      if (action==="reject") return;
      const approved = action==="approve";
      btn.disabled=true;
      const {error:updateError} = await supabase.from("profiles").update({approved}).eq("id",id);
      if (updateError) alert("Could not update access: "+updateError.message);
      await loadMembers();
    });
  });
}

$("photoInput").addEventListener("change", () => {
  $("photoName").textContent = $("photoInput").files[0]?.name || "";
});
$("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (currentProfile?.role !== "admin") return;
  const text = $("postText").value.trim();
  const file = $("photoInput").files[0];
  if (!text && !file) return showMessage("postMessage","Write a message or choose a photo.",true);
  if (file && (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 5*1024*1024))
    return showMessage("postMessage","Choose a JPG, PNG or WebP photo smaller than 5 MB.",true);
  showMessage("postMessage","Sharing…");
  let photoPath = null;
  if (file) {
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g,"-");
    photoPath = `${currentUser.id}/${Date.now()}-${safeName}`;
    const {error:uploadError} = await supabase.storage.from("family-photos").upload(photoPath,file,{upsert:false,contentType:file.type});
    if (uploadError) return showMessage("postMessage","Photo upload failed: "+uploadError.message,true);
  }
  const {error} = await supabase.from("messages").insert({
    sender_id:currentUser.id, message_text:text || null, photo_path:photoPath
  });
  if (error) {
    if (photoPath) await supabase.storage.from("family-photos").remove([photoPath]);
    return showMessage("postMessage","Could not publish: "+error.message,true);
  }
  $("postText").value=""; $("photoInput").value=""; $("photoName").textContent="";
  showMessage("postMessage","Shared with your family.");
  await loadFeed();
});

async function loadFeed() {
  $("feed").innerHTML='<div class="empty">Loading family moments…</div>';
  const {data,error} = await supabase.from("messages")
    .select("id,sender_id,message_text,photo_path,created_at")
    .order("created_at",{ascending:false}).limit(100);
  if (error) { $("feed").innerHTML=`<div class="empty">Could not load messages: ${escapeHtml(error.message)}</div>`; return; }
  if (!data?.length) { $("feed").innerHTML='<div class="empty">No family posts yet. The first memory can be shared by the admin.</div>'; return; }
  const cards = await Promise.all(data.map(async post => {
    let photoUrl = null;
    if (post.photo_path) {
      const {data: signed} = await supabase.storage.from("family-photos").createSignedUrl(post.photo_path,3600);
      photoUrl = signed?.signedUrl || null;
    }
    return `<article class="post">
      ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" alt="Family photo" loading="lazy">` : ""}
      <div class="post-body"><div class="post-meta">${escapeHtml(formatDate(post.created_at))}</div>
      ${post.message_text ? `<div class="post-text">${escapeHtml(post.message_text)}</div>` : ""}
      ${post.photo_path && !photoUrl ? '<p class="muted small">Photo could not be displayed.</p>' : ""}</div>
    </article>`;
  }));
  $("feed").innerHTML=cards.join("");
}
$("refreshBtn").addEventListener("click",loadFeed);
start();

if ("serviceWorker" in navigator && location.protocol !== "file:") { window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {})); }
