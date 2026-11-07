import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6ky_ETioOqiONq9T4uousDRpOzOMRRn0",
  authDomain: "veter-social.firebaseapp.com",
  projectId: "veter-social",
  storageBucket: "veter-social.firebasestorage.app",
  messagingSenderId: "504664421504",
  appId: "1:504664421504:web:a1f681566757c31b69a265",
  measurementId: "G-D19HJNGF9S"
};
const SUPABASE_URL = "https://qqvfphefusvbveucqbrj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxdmZwaGVmdXN2YnZldWNxYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNzA0MTYsImV4cCI6MjEwOTY0NjQxNn0.1C8kEAnmc7vLpF1bGiSsVVkm8egVsaPqsW7mGfApPJA";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const $ = id => document.getElementById(id);
let db = null;
let me = null;
let activeConversation = null;
let activePartner = null;
let messageChannel = null;
let cachedPeople = [];

function status(message, error = false) {
  const node = $("app-status") || $("auth-status");
  if (node) {
    node.textContent = message;
    node.dataset.error = error ? "true" : "false";
  }
}
function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function initials(name = "V") {
  return name.trim().split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase();
}
function avatar(profile, id = "") {
  const url = profile?.avatar_url;
  return url ? esc(url) : "https://ui-avatars.com/api/?name=" + encodeURIComponent(profile?.display_name || "Veter") + "&background=182846&color=ffffff";
}
function friendly(error) {
  console.error("Veter Social:", error);
  const code = error?.code || error?.message || "";
  if (String(code).includes("Invalid API key") || String(code).includes("Invalid API")) return "Supabase rejected the API key. Check that the Supabase project key is active and copied correctly.";
  if (String(code).includes("JWT") || String(code).includes("third-party")) return "Firebase token is not accepted by Supabase yet. Check the Firebase third-party integration in Supabase.";
  if (error?.code === "42501" || error?.code === "PGRST301") return "Database permissions are blocking this action. Check the Veter Social database policies.";
  if (error?.code === "23505") return "That username is already taken. Choose another one.";
  return error?.message || "Something went wrong. Please try again.";
}
async function getDb() {
  if (db) return db;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.119.0");
  db = createClient(SUPABASE_URL, SUPABASE_KEY, {
    accessToken: async () => auth.currentUser ? await auth.currentUser.getIdToken() : null,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return db;
}

async function saveProfile(user) {
  const client = await getDb();
  const { data: existing, error: readError } = await client.from("user_profiles")
    .select("*").eq("uid", user.uid).maybeSingle();
  if (readError) throw readError;
  const profile = {
    uid: user.uid,
    display_name: existing?.display_name || (user.displayName || "Veter member").slice(0,40),
    avatar_url: existing?.avatar_url || user.photoURL || null,
    country: existing?.country || "",
    languages: existing?.languages || [],
    bio: existing?.bio || "",
    username: existing?.username || null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await client.from("user_profiles").upsert(profile, {onConflict:"uid"}).select().single();
  if (error) throw error;
  return data;
}
function showSignedIn(user, profile) {
  $("social-welcome").hidden = true;
  $("join").hidden = true;
  $("social-safety-public").hidden = true;
  $("social-app").hidden = false;
  $("my-name").textContent = profile.display_name || user.displayName || "Veter member";
  $("my-email").textContent = user.email || user.phoneNumber || "";
  $("my-avatar").src = avatar(profile);
  $("profile-name").value = profile.display_name || "";
  $("profile-username").value = profile.username || "";
  $("profile-country").value = profile.country || "";
  $("profile-bio").value = profile.bio || "";
  $("profile-avatar").value = profile.avatar_url || "";
}
function showSignedOut() {
  $("social-welcome").hidden = false;
  $("join").hidden = false;
  $("social-safety-public").hidden = false;
  $("social-app").hidden = true;
  activeConversation = null;
  activePartner = null;
  if (messageChannel && db) db.removeChannel(messageChannel);
  messageChannel = null;
}
function switchView(name) {
  document.querySelectorAll(".social-tab").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".social-view").forEach(v => v.hidden = v.id !== "view-" + name);
  if (name === "chats") loadConversations();
  if (name === "discover") loadPeople();
}

async function loadPeople() {
  try {
    const client = await getDb();
    const [{data: profiles,error}, {data: blocks}] = await Promise.all([
      client.from("user_profiles").select("uid,display_name,avatar_url,country,bio,username").neq("uid",me.uid).order("updated_at",{ascending:false}).limit(60),
      client.from("blocks").select("blocked_uid").eq("blocker_uid",me.uid)
    ]);
    if (error) throw error;
    const blocked = new Set((blocks || []).map(x => x.blocked_uid));
    cachedPeople = (profiles || []).filter(p => !blocked.has(p.uid));
    renderPeople(cachedPeople);
  } catch (e) { status(friendly(e), true); }
}
function renderPeople(profiles) {
  const host = $("people-list");
  if (!profiles.length) { host.innerHTML = '<p class="empty-state">No other profiles yet. Invite a friend to join Veter Social.</p>'; return; }
  host.innerHTML = profiles.map(p => `
    <article class="person-card">
      <img src="${avatar(p)}" alt="" loading="lazy">
      <div class="person-info"><b>${esc(p.display_name)}</b><small>${esc([p.username ? "@"+p.username : "",p.country].filter(Boolean).join(" · ") || "Veter member")}</small>
      <p>${esc(p.bio || "Ready to meet new people.")}</p></div>
      <button data-chat-user="${esc(p.uid)}">Message</button>
    </article>`).join("");
}
async function openConversation(partnerUid) {
  try {
    const client = await getDb();
    status("Opening conversation…");
    let {data: convs,error} = await client.from("conversations").select("*")
      .or(`and(participant_a.eq.${me.uid},participant_b.eq.${partnerUid}),and(participant_a.eq.${partnerUid},participant_b.eq.${me.uid})`)
      .order("created_at",{ascending:false}).limit(1);
    if (error) throw error;
    let conversation = convs?.[0];
    if (!conversation) {
      const result = await client.from("conversations").insert({
        participant_a:me.uid, participant_b:partnerUid, state:"open"
      }).select().single();
      if (result.error) {
        // Another tab may have created it at the same time.
        const retry = await client.from("conversations").select("*")
          .or(`and(participant_a.eq.${me.uid},participant_b.eq.${partnerUid}),and(participant_a.eq.${partnerUid},participant_b.eq.${me.uid})`)
          .order("created_at",{ascending:false}).limit(1);
        if (retry.error || !retry.data?.[0]) throw result.error;
        conversation = retry.data[0];
      } else conversation = result.data;
    }
    activeConversation = conversation;
    const {data: partner,error: partnerError} = await client.from("user_profiles")
      .select("uid,display_name,avatar_url,country").eq("uid",partnerUid).single();
    if (partnerError) throw partnerError;
    activePartner = partner;
    switchView("chats");
    $("chat-empty").hidden = true;
    $("active-chat").hidden = false;
    $("chat-name").textContent = partner.display_name || "Veter member";
    $("chat-avatar").src = avatar(partner);
    await loadMessages();
    subscribeMessages();
    $("message-input").focus();
    status("Private conversation opened.");
  } catch (e) { status(friendly(e), true); }
}
async function loadConversations() {
  if (!me) return;
  try {
    const client = await getDb();
    const {data,error} = await client.from("conversations").select("*")
      .or(`participant_a.eq.${me.uid},participant_b.eq.${me.uid}`)
      .order("last_message_at",{ascending:false}).limit(50);
    if (error) throw error;
    const conversations = data || [];
    $("chat-count").textContent = conversations.length ? String(conversations.length) : "";
    const otherIds = [...new Set(conversations.map(c => c.participant_a === me.uid ? c.participant_b : c.participant_a))];
    let profiles = [];
    if (otherIds.length) {
      const p = await client.from("user_profiles").select("uid,display_name,avatar_url,country").in("uid",otherIds);
      if (p.error) throw p.error;
      profiles = p.data || [];
    }
    const byId = new Map(profiles.map(p => [p.uid,p]));
    const host = $("chat-list");
    if (!conversations.length) { host.innerHTML = '<p class="empty-state">No conversations yet. Discover someone to say hello.</p>'; return; }
    host.innerHTML = conversations.map(c => {
      const id = c.participant_a === me.uid ? c.participant_b : c.participant_a;
      const p = byId.get(id) || {display_name:"Veter member"};
      return `<button class="chat-list-item" data-open-chat="${esc(id)}"><img src="${avatar(p)}" alt=""><span><b>${esc(p.display_name)}</b><small>${new Date(c.last_message_at || c.created_at).toLocaleString()}</small></span></button>`;
    }).join("");
  } catch (e) { status(friendly(e), true); }
}
async function loadMessages() {
  if (!activeConversation) return;
  const client = await getDb();
  const {data,error} = await client.from("messages").select("*")
    .eq("conversation_id",activeConversation.id).order("created_at",{ascending:true}).limit(200);
  if (error) throw error;
  const host = $("chat-messages");
  host.innerHTML = (data || []).map(renderMessage).join("");
  host.scrollTop = host.scrollHeight;
}
function renderMessage(m) {
  const mine = m.sender_uid === me.uid;
  return `<div class="message-row ${mine ? "mine" : ""}"><div class="message-bubble">${esc(m.body)}<small>${new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small></div></div>`;
}
function subscribeMessages() {
  if (messageChannel && db) db.removeChannel(messageChannel);
  messageChannel = db.channel("veter-chat-" + activeConversation.id)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+activeConversation.id},payload => {
      const host = $("chat-messages");
      if (!host.querySelector('[data-message-id="'+payload.new.id+'"]')) {
        const wrap = document.createElement("div");
        wrap.innerHTML = renderMessage(payload.new);
        const node = wrap.firstElementChild;
        node.dataset.messageId = payload.new.id;
        host.appendChild(node);
        host.scrollTop = host.scrollHeight;
      }
    }).subscribe();
}
async function sendMessage(event) {
  event.preventDefault();
  const body = $("message-input").value.trim();
  if (!body || !activeConversation) return;
  $("message-input").disabled = true;
  try {
    const client = await getDb();
    const {error} = await client.from("messages").insert({
      conversation_id:activeConversation.id,sender_uid:me.uid,body
    });
    if (error) throw error;
    $("message-input").value = "";
    await loadMessages();
    await client.from("conversations").update({last_message_at:new Date().toISOString()}).eq("id",activeConversation.id);
    loadConversations();
  } catch (e) { status(friendly(e), true); }
  finally { $("message-input").disabled = false; $("message-input").focus(); }
}
async function saveMyProfile(event) {
  event.preventDefault();
  const username = $("profile-username").value.trim().toLowerCase().replace(/^@/,"");
  if (username && !/^[a-z0-9_]{3,24}$/.test(username)) {
    status("Username must be 3–24 characters: letters, numbers or underscore.", true); return;
  }
  try {
    const client = await getDb();
    const profile = {
      uid:me.uid,
      display_name:$("profile-name").value.trim(),
      username:username || null,
      country:$("profile-country").value.trim(),
      bio:$("profile-bio").value.trim(),
      avatar_url:$("profile-avatar").value.trim() || me.photoURL || null,
      updated_at:new Date().toISOString()
    };
    const {data,error} = await client.from("user_profiles").upsert(profile,{onConflict:"uid"}).select().single();
    if (error) throw error;
    $("my-name").textContent = data.display_name;
    $("my-avatar").src = avatar(data);
    status("Profile saved successfully.");
    loadPeople();
  } catch(e) { status(friendly(e),true); }
}
async function blockPartner() {
  if (!activePartner || !confirm("Block this person? You won't be able to start new conversations.")) return;
  try {
    const client = await getDb();
    const {error} = await client.from("blocks").insert({blocker_uid:me.uid,blocked_uid:activePartner.uid});
    if (error && error.code !== "23505") throw error;
    status("This person is blocked.");
    activeConversation = null; activePartner = null;
    $("active-chat").hidden = true; $("chat-empty").hidden = false;
    loadPeople(); loadConversations();
  } catch(e) { status(friendly(e),true); }
}
async function reportPartner() {
  if (!activePartner || !activeConversation) return;
  const reason = prompt("Report reason: harassment, spam, underage, sexual_content, threats, or other");
  if (!reason) return;
  const allowed = ["harassment","spam","underage","sexual_content","threats","other"];
  if (!allowed.includes(reason.trim())) { status("Please enter one of the listed report reasons.",true); return; }
  try {
    const client = await getDb();
    const {error} = await client.from("reports").insert({
      reporter_uid:me.uid,reported_uid:activePartner.uid,conversation_id:activeConversation.id,reason:reason.trim()
    });
    if (error) throw error;
    status("Report submitted. Thank you for helping keep the community safe.");
  } catch(e) { status(friendly(e),true); }
}

$("google-sign-in").addEventListener("click", async () => {
  const button = $("google-sign-in");
  button.disabled = true;
  status("Opening Google sign-in…");
  try {
    await signInWithPopup(auth,new GoogleAuthProvider());
  } catch(e) { status(friendly(e),true); }
  finally { button.disabled = false; }
});
$("sign-out").addEventListener("click", async () => {
  try { await signOut(auth); status("You are signed out."); }
  catch(e) { status(friendly(e),true); }
});
document.querySelectorAll(".social-tab").forEach(b => b.addEventListener("click",() => switchView(b.dataset.view)));
$("people-list").addEventListener("click",e => {
  const button = e.target.closest("[data-chat-user]");
  if (button) openConversation(button.dataset.chatUser);
});
$("chat-list").addEventListener("click",e => {
  const button = e.target.closest("[data-open-chat]");
  if (button) openConversation(button.dataset.openChat);
});
$("message-form").addEventListener("submit",sendMessage);
$("profile-form").addEventListener("submit",saveMyProfile);
$("block-chat").addEventListener("click",blockPartner);
$("report-chat").addEventListener("click",reportPartner);
$("people-search").addEventListener("input",e => {
  const q = e.target.value.toLowerCase().trim();
  renderPeople(cachedPeople.filter(p => [p.display_name,p.username,p.country,p.bio].some(v => (v || "").toLowerCase().includes(q))));
});

onAuthStateChanged(auth, async user => {
  me = user;
  if (!user) { showSignedOut(); status("Sign in to join Veter Social."); return; }
  try {
    status("Signed in. Preparing your profile…");
    const profile = await saveProfile(user);
    showSignedIn(user,profile);
    status("Welcome back, " + profile.display_name + "!");
    await Promise.all([loadPeople(),loadConversations()]);
  } catch(e) {
    showSignedOut();
    status("Google sign-in worked, but the database connection needs attention: " + friendly(e),true);
  }
});
window.addEventListener("beforeunload",() => {
  if (messageChannel && db) db.removeChannel(messageChannel);
});
