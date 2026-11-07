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
let themeMode = "dark";

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

function applyTheme(mode) {
  themeMode = mode === "light" ? "light" : "dark";
  document.body.classList.toggle("social-light",themeMode === "light");
  $("theme-toggle").textContent = themeMode === "light" ? "🌙 Dark mode" : "☀️ Light mode";
  try { localStorage.setItem("veter-social-theme",themeMode); } catch {}
}
async function sendFriendRequest(uid) {
  try {
    const client = await getDb();
    const {data: prior,error: readError} = await client.from("social_friend_requests").select("id,status,sender_uid,receiver_uid").or(`and(sender_uid.eq.${me.uid},receiver_uid.eq.${uid}),and(sender_uid.eq.${uid},receiver_uid.eq.${me.uid})`).limit(1);
    if (readError) throw readError;
    const existing = prior?.[0];
    if (existing?.status === "accepted") { status("You are already connected."); return; }
    if (existing?.status === "pending") { status(existing.sender_uid === me.uid ? "Friend request already sent." : "This person has already sent you a request."); return; }
    if (existing?.status === "rejected") { status("This friend request was previously declined."); return; }
    const {error} = await client.from("social_friend_requests").insert({sender_uid:me.uid,receiver_uid:uid,status:"pending"});
    if (error) throw error;
    status("Friend request sent!");
    await Promise.all([loadPeople(),loadFriendRequests()]);
  } catch(e) { status(friendly(e),true); }
}
async function sendFriendRequestByUsername(event) {
  event.preventDefault();
  const field = $("friend-veter-id");
  const username = field.value.trim().replace(/^@/,"").toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    status("Enter a valid Veter username (3–24 letters, numbers or underscores).",true);
    return;
  }
  const button = $("add-by-id-form").querySelector("button");
  button.disabled = true;
  try {
    const client = await getDb();
    const {data: profile,error} = await client.from("user_profiles")
      .select("uid,username").eq("username",username).maybeSingle();
    if (error) throw error;
    if (!profile) {
      status("No Veter account found with that username.",true);
      return;
    }
    if (profile.uid === me.uid) {
      status("You cannot send a friend request to yourself.",true);
      return;
    }
    await sendFriendRequest(profile.uid);
    field.value = "";
  } catch (e) {
    status(friendly(e),true);
  } finally {
    button.disabled = false;
  }
}
async function loadFriendRequests() {
  try {
    const client = await getDb();
    const {data: rows,error} = await client.from("social_friend_requests").select("*").or(`sender_uid.eq.${me.uid},receiver_uid.eq.${me.uid}`).order("created_at",{ascending:false});
    if (error) throw error;
    const ids = [...new Set((rows || []).flatMap(r => [r.sender_uid,r.receiver_uid]).filter(id => id !== me.uid))];
    let profiles = [];
    if (ids.length) { const result = await client.from("user_profiles").select("uid,display_name,avatar_url,username").in("uid",ids); if (result.error) throw result.error; profiles = result.data || []; }
    const byId = new Map(profiles.map(p => [p.uid,p]));
    const card = (row,other,buttons="") => { const p = byId.get(other) || {display_name:"Veter member"}; return `<article class="friend-row"><img src="${avatar(p)}" alt=""><div><b>${esc(p.display_name)}</b><small>${row.status === "pending" ? "Pending request" : "Friends"}</small></div>${buttons}</article>`; };
    const incoming = (rows || []).filter(r => r.receiver_uid === me.uid && r.status === "pending");
    const outgoing = (rows || []).filter(r => r.sender_uid === me.uid && r.status === "pending");
    const accepted = (rows || []).filter(r => r.status === "accepted");
    $("incoming-friends").innerHTML = incoming.length ? incoming.map(r => card(r,r.sender_uid,`<button data-friend-response="accepted" data-request-id="${r.id}">Accept</button><button data-friend-response="rejected" data-request-id="${r.id}">Decline</button>`)).join("") : '<p class="empty-state">No incoming requests.</p>';
    $("outgoing-friends").innerHTML = outgoing.length ? outgoing.map(r => card(r,r.receiver_uid)).join("") : '<p class="empty-state">No sent requests.</p>';
    $("accepted-friends").innerHTML = accepted.length ? accepted.map(r => card(r,r.sender_uid === me.uid ? r.receiver_uid : r.sender_uid)).join("") : '<p class="empty-state">Your friend list is waiting to grow.</p>';
    $("friend-count").textContent = incoming.length ? String(incoming.length) : "";
    window.veterFriendRequests = rows || [];
  } catch(e) { status(friendly(e),true); }
}
async function loadNotifications() {
  try {
    const client = await getDb();
    const {data: rows,error} = await client.from("social_notifications").select("*").order("created_at",{ascending:false}).limit(60);
    if (error) throw error;
    const unread = (rows || []).filter(n => !n.read_at).length;
    $("notification-count").textContent = unread ? String(unread) : "";
    if (!rows?.length) { $("notification-list").innerHTML = '<p class="empty-state">You are all caught up. New activity will appear here.</p>'; return; }
    const actorIds = [...new Set(rows.map(n => n.actor_uid))];
    const {data: people,error: peopleError} = await client.from("user_profiles").select("uid,display_name,avatar_url").in("uid",actorIds);
    if (peopleError) throw peopleError;
    const byId = new Map((people || []).map(p => [p.uid,p]));
    $("notification-list").innerHTML = rows.map(n => { const actor = byId.get(n.actor_uid) || {display_name:"A Veter member"}; const icon = ({friend_request:"👥",friend_accepted:"🤝",reaction:"❤️",comment:"💬"})[n.notification_type] || "🔔"; return `<article class="notification-row ${n.read_at ? "" : "unread"}"><img src="${avatar(actor)}" alt=""><div><b>${esc(actor.display_name)}</b> ${esc(n.message)}<small>${new Date(n.created_at).toLocaleString()}</small></div><span>${icon}</span></article>`; }).join("");
  } catch(e) { status(friendly(e),true); }
}
async function markNotificationsRead() {
  try { const client = await getDb(); const {error} = await client.from("social_notifications").update({read_at:new Date().toISOString()}).eq("recipient_uid",me.uid).is("read_at",null); if (error) throw error; await loadNotifications(); status("Notifications marked as read."); }
  catch(e) { status(friendly(e),true); }
}

function switchView(name) {
  document.querySelectorAll(".social-tab").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".social-view").forEach(v => v.hidden = v.id !== "view-" + name);
  if (name === "feed") loadFeed();
  if (name === "chats") loadConversations();
  if (name === "discover") loadPeople();
  if (name === "friends") loadFriendRequests();
  if (name === "notifications") loadNotifications();
  if (name === "saved") loadFeed("saved-list",true);
}

async function loadPeople() {
  try {
    const client = await getDb();
    const [{data: profiles,error}, {data: blocks,error: blockError}, {data: requests,error: requestError}] = await Promise.all([
      client.from("user_profiles").select("uid,display_name,avatar_url,country,bio,username").neq("uid",me.uid).order("updated_at",{ascending:false}).limit(60),
      client.from("blocks").select("blocked_uid").eq("blocker_uid",me.uid),
      client.from("social_friend_requests").select("id,sender_uid,receiver_uid,status").or(`sender_uid.eq.${me.uid},receiver_uid.eq.${me.uid}`)
    ]);
    if (error) throw error; if (blockError) throw blockError; if (requestError) throw requestError;
    const blocked = new Set((blocks || []).map(x => x.blocked_uid));
    cachedPeople = (profiles || []).filter(p => !blocked.has(p.uid));
    window.veterFriendRequests = requests || [];
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
      <div class="person-actions"><button data-friend-user="${esc(p.uid)}">Add friend</button><button data-chat-user="${esc(p.uid)}">Message</button></div>
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
let selectedPostPhoto = null;
function clearPostPhoto() {
  selectedPostPhoto = null;
  $("post-photo").value = "";
  $("photo-file-name").textContent = "No photo selected · max 8 MB";
  $("photo-preview-wrap").hidden = true;
  $("photo-preview").removeAttribute("src");
}
async function uploadPostPhoto(file) {
  const extension = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif" })[file.type];
  if (!extension) throw new Error("Choose a JPG, PNG, WEBP or GIF image.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Photo must be 8 MB or smaller.");
  const client = await getDb();
  const path = me.uid + "/" + crypto.randomUUID() + "." + extension;
  const { error } = await client.storage.from("social-photos").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
  if (error) throw error;
  return client.storage.from("social-photos").getPublicUrl(path).data.publicUrl;
}
async function loadFeed(hostId = "feed-list", savedOnly = false) {
  if (!me) return;
  const host = $(hostId);
  host.innerHTML = '<p class="empty-state">Loading community posts…</p>';
  try {
    const client = await getDb();
    let postsQuery = client.from('social_posts').select('*').order('created_at',{ascending:false}).limit(60);
    if (savedOnly) {
      const {data: savedRows,error: savedError} = await client.from('social_post_saves').select('post_id').eq('user_uid',me.uid);
      if (savedError) throw savedError;
      const savedIds = (savedRows || []).map(x => x.post_id);
      if (!savedIds.length) { host.innerHTML = '<p class="empty-state">No saved posts yet. Tap Save on a post to keep it here.</p>'; return; }
      postsQuery = client.from('social_posts').select('*').in('id',savedIds).order('created_at',{ascending:false});
    }
    const {data: posts,error} = await postsQuery;
    if (error) throw error;
    if (!posts?.length) { host.innerHTML = '<p class="empty-state">No posts yet. Be the first to share something with the community! 🌱</p>'; return; }
    const ids = posts.map(p => p.id);
    const authorIds = [...new Set(posts.map(p => p.author_uid))];
    const [{data: profiles,error: profileError},{data: likes,error: likesError},{data: comments,error: commentsError},{data: reactions,error: reactionsError},{data: saves,error: savesError}] = await Promise.all([
      client.from("user_profiles").select("uid,display_name,avatar_url,username").in("uid",authorIds),
      client.from("social_post_likes").select("post_id,user_uid").in("post_id",ids),
      client.from("social_post_comments").select("id,post_id,author_uid,body,created_at").in("post_id",ids).order("created_at",{ascending:true}),
      client.from("social_post_reactions").select("post_id,user_uid,reaction").in("post_id",ids),
      client.from("social_post_saves").select("post_id,user_uid").eq("user_uid",me.uid).in("post_id",ids)
    ]);
    if (profileError) throw profileError;
    if (likesError) throw likesError;
    if (commentsError) throw commentsError;
    if (reactionsError) throw reactionsError; if (savesError) throw savesError;
    const commentAuthors = [...new Set((comments || []).map(c => c.author_uid))];
    let commentProfiles = [];
    if (commentAuthors.length) {
      const result = await client.from("user_profiles").select("uid,display_name,avatar_url").in("uid",commentAuthors);
      if (result.error) throw result.error;
      commentProfiles = result.data || [];
    }
    const byId = new Map([...(profiles || []), ...commentProfiles].map(p => [p.uid,p]));
    const likesByPost = new Map();
    const commentsByPost = new Map();
    const reactionsByPost = new Map();
    const savedIds = new Set((saves || []).map(x => x.post_id));
    for (const r of reactions || []) { if (!reactionsByPost.has(r.post_id)) reactionsByPost.set(r.post_id,[]); reactionsByPost.get(r.post_id).push(r); }
    for (const like of likes || []) {
      if (!likesByPost.has(like.post_id)) likesByPost.set(like.post_id,[]);
      likesByPost.get(like.post_id).push(like.user_uid);
    }
    for (const comment of comments || []) {
      if (!commentsByPost.has(comment.post_id)) commentsByPost.set(comment.post_id,[]);
      commentsByPost.get(comment.post_id).push(comment);
    }
    host.innerHTML = posts.map(post => {
      const author = byId.get(post.author_uid) || {display_name:"Veter member"};
      const likedBy = likesByPost.get(post.id) || [];
      const mine = post.author_uid === me.uid;
      const myReaction = (reactionsByPost.get(post.id) || []).find(x => x.user_uid === me.uid)?.reaction || "";
      return `<article class="feed-post" data-post-id="${esc(post.id)}">
        <div class="feed-author"><img src="${avatar(author)}" alt=""><div><b>${esc(author.display_name)}</b><small>${author.username ? "@"+esc(author.username)+" · " : ""}${new Date(post.created_at).toLocaleString()}</small></div>${mine ? '<button class="post-delete" data-delete-post>Delete</button>' : ""}</div>
        <p class="feed-body">${esc(post.body)}</p>
        ${post.image_url ? '<img class="feed-photo" src="' + esc(post.image_url) + '" alt="Photo shared by ' + esc(author.display_name) + '" loading="lazy">' : ""}
        <div class="feed-actions"><button data-like-post class="${likedBy.includes(me.uid) ? "liked" : ""}">${likedBy.includes(me.uid) ? "♥ Liked" : "♡ Like"} · ${likedBy.length}</button><button data-comment-post>💬 Comment · ${(commentsByPost.get(post.id) || []).length}</button><button data-save-post>${savedIds.has(post.id) ? "🔖 Saved" : "🔖 Save"}</button></div><div class="reaction-bar"><select data-reaction aria-label="Choose a reaction"><option value="">React…</option><option value="like" ${myReaction==="like"?"selected":""}>👍 Like</option><option value="love" ${myReaction==="love"?"selected":""}>❤️ Love</option><option value="haha" ${myReaction==="haha"?"selected":""}>😂 Haha</option><option value="wow" ${myReaction==="wow"?"selected":""}>😮 Wow</option><option value="sad" ${myReaction==="sad"?"selected":""}>😢 Sad</option><option value="angry" ${myReaction==="angry"?"selected":""}>😡 Angry</option></select><span>${(reactionsByPost.get(post.id)||[]).length} reactions</span></div>
        <form class="social-comment-form" data-comment-form hidden><textarea maxlength="500" rows="2" placeholder="Write a comment..." aria-label="Write a comment"></textarea><button type="submit">Post comment</button></form>
        <div class="post-comments">${(commentsByPost.get(post.id) || []).map(comment => {
          const commenter = byId.get(comment.author_uid) || {display_name:"Veter member"};
          return `<div class="post-comment"><b>${esc(commenter.display_name)}</b><span>${esc(comment.body)}</span><small>${new Date(comment.created_at).toLocaleString()}</small></div>`;
        }).join("") || '<p class="no-comments">No comments yet.</p>'}</div>
      </article>`;
    }).join("");
  } catch (e) { host.innerHTML = '<p class="empty-state">Could not load posts.</p>'; status(friendly(e),true); }
}
async function publishPost(event) {
  event.preventDefault();
  const body = $("post-body").value.trim();
  if (!body && !selectedPostPhoto) { status("Write something or choose a photo first.",true); return; }
  const button = $("post-form").querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const client = await getDb();
    let image_url = null;
    if (selectedPostPhoto) { status("Uploading your photo…"); image_url = await uploadPostPhoto(selectedPostPhoto); }
    const {error} = await client.from("social_posts").insert({author_uid:me.uid,body,image_url});
    if (error) throw error;
    $("post-body").value = "";
    $("post-char-count").textContent = "0";
    clearPostPhoto();
    status("Your post is live in the Veter community!");
    await loadFeed();
  } catch (e) { status(friendly(e),true); }
  finally { button.disabled = false; }
}
async function handleFeedAction(event) {
  const card = event.target.closest("[data-post-id]");
  if (!card) return;
  const postId = card.dataset.postId;
  if (event.type === "change" && event.target.matches("[data-reaction]")) {
    try { const client = await getDb(); const reaction = event.target.value;
      if (!reaction) { const {error} = await client.from("social_post_reactions").delete().eq("post_id",postId).eq("user_uid",me.uid); if (error) throw error; }
      else { const {error} = await client.from("social_post_reactions").upsert({post_id:postId,user_uid:me.uid,reaction},{onConflict:"post_id,user_uid"}); if (error) throw error; }
      const savedView = !!event.target.closest("#saved-list"); await loadFeed(savedView ? "saved-list" : "feed-list",savedView);
    } catch(e) { status(friendly(e),true); } return;
  }
  if (event.type === "click" && event.target.closest("[data-save-post]")) {
    try { const client = await getDb(); const {data: existing,error: readError} = await client.from("social_post_saves").select("post_id").eq("post_id",postId).eq("user_uid",me.uid).maybeSingle(); if (readError) throw readError;
      if (existing) { const {error} = await client.from("social_post_saves").delete().eq("post_id",postId).eq("user_uid",me.uid); if (error) throw error; }
      else { const {error} = await client.from("social_post_saves").insert({post_id:postId,user_uid:me.uid}); if (error) throw error; }
      status(existing ? "Post removed from saved posts." : "Post saved."); await loadFeed(); if (!$("view-saved").hidden) await loadFeed("saved-list",true);
    } catch(e) { status(friendly(e),true); } return;
  }
  if (event.type === "click" && event.target.closest("[data-comment-post]")) {
    const form = card.querySelector("[data-comment-form]");
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("textarea")?.focus();
    return;
  }
  if (event.type === "submit" && event.target.matches("[data-comment-form]")) {
    event.preventDefault();
    const field = event.target.querySelector("textarea");
    const body = field?.value.trim() || "";
    if (!body) { field?.focus(); return; }
    if (body.length > 500) { status("Comments can be up to 500 characters.",true); return; }
    const submit = event.target.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const client = await getDb();
      const {error} = await client.from("social_post_comments").insert({post_id:postId,author_uid:me.uid,body});
      if (error) throw error;
      status("Comment added. Thanks for joining the conversation!");
      const savedView = !!card.closest("#saved-list");
      await loadFeed(savedView ? "saved-list" : "feed-list",savedView);
    } catch (e) {
      status(friendly(e),true);
      if (submit) submit.disabled = false;
    }
    return;
  }
  try {
    const client = await getDb();
    if (event.target.closest("[data-like-post]")) {
      const {data: existing,error: readError} = await client.from("social_post_likes").select("post_id").eq("post_id",postId).eq("user_uid",me.uid).maybeSingle();
      if (readError) throw readError;
      const result = existing
        ? await client.from("social_post_likes").delete().eq("post_id",postId).eq("user_uid",me.uid)
        : await client.from("social_post_likes").insert({post_id:postId,user_uid:me.uid});
      if (result.error) throw result.error;
      const savedView = !!card.closest("#saved-list");
      await loadFeed(savedView ? "saved-list" : "feed-list",savedView);
    } else if (event.target.closest("[data-delete-post]")) {
      if (!confirm("Delete your post? This cannot be undone.")) return;
      const {error} = await client.from("social_posts").delete().eq("id",postId).eq("author_uid",me.uid);
      if (error) throw error;
      await loadFeed();
      status("Your post was deleted.");
    }
  } catch (e) { status(friendly(e),true); }
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
  return `<div class="message-row ${mine ? "mine" : ""}" data-message-id="${esc(m.id)}"><div class="message-bubble">${esc(m.body)}<small>${new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small></div></div>`;
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

$("theme-toggle").addEventListener("click",() => applyTheme(themeMode === "dark" ? "light" : "dark"));
$("mark-notifications-read").addEventListener("click",markNotificationsRead);
$("incoming-friends").addEventListener("click",async e => {
  const button = e.target.closest("[data-friend-response]");
  if (!button) return;
  button.disabled = true;
  try { const client = await getDb(); const {error} = await client.from("social_friend_requests").update({status:button.dataset.friendResponse,updated_at:new Date().toISOString()}).eq("id",button.dataset.requestId); if (error) throw error; status(button.dataset.friendResponse === "accepted" ? "Friend request accepted!" : "Friend request declined."); await Promise.all([loadFriendRequests(),loadPeople(),loadNotifications()]); }
  catch(err) { status(friendly(err),true); button.disabled = false; }
});
$("people-list").addEventListener("click",e => {
  const friendButton = e.target.closest("[data-friend-user]");
  if (friendButton) { sendFriendRequest(friendButton.dataset.friendUser); return; }
  const button = e.target.closest("[data-chat-user]");
  if (button) openConversation(button.dataset.chatUser);
});
$("chat-list").addEventListener("click",e => {
  const button = e.target.closest("[data-open-chat]");
  if (button) openConversation(button.dataset.openChat);
});
$("message-form").addEventListener("submit",sendMessage);
$("post-form").addEventListener("submit",publishPost);
$("feed-list").addEventListener("click",handleFeedAction);
$("feed-list").addEventListener("change",handleFeedAction);
$("feed-list").addEventListener("submit",handleFeedAction);
$("saved-list").addEventListener("click",handleFeedAction);
$("saved-list").addEventListener("change",handleFeedAction);
$("saved-list").addEventListener("submit",handleFeedAction);
$("post-body").addEventListener("input",e => $("post-char-count").textContent = String(e.target.value.length));
$("post-photo").addEventListener("change",e => {
  const file = e.target.files?.[0];
  if (!file) { clearPostPhoto(); return; }
  const allowed = ["image/jpeg","image/png","image/webp","image/gif"];
  if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
    clearPostPhoto();
    status("Choose a JPG, PNG, WEBP or GIF image up to 8 MB.",true);
    return;
  }
  selectedPostPhoto = file;
  $("photo-file-name").textContent = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    if (selectedPostPhoto !== file) return;
    $("photo-preview").src = String(reader.result);
    $("photo-preview-wrap").hidden = false;
    status("Photo ready to preview.");
  };
  reader.onerror = () => {
    clearPostPhoto();
    status("Could not preview this photo. Please choose it again.",true);
  };
  reader.readAsDataURL(file);
});
$("remove-photo").addEventListener("click",clearPostPhoto);
$("profile-form").addEventListener("submit",saveMyProfile);
$("add-by-id-form").addEventListener("submit",sendFriendRequestByUsername);
$("block-chat").addEventListener("click",blockPartner);
$("report-chat").addEventListener("click",reportPartner);
$("people-search").addEventListener("input",e => {
  const q = e.target.value.toLowerCase().trim();
  renderPeople(cachedPeople.filter(p => [p.display_name,p.username,p.country,p.bio].some(v => (v || "").toLowerCase().includes(q))));
});

try { applyTheme(localStorage.getItem("veter-social-theme") || "dark"); } catch { applyTheme("dark"); }
onAuthStateChanged(auth, async user => {
  me = user;
  if (!user) { showSignedOut(); status("Sign in to join Veter Social."); return; }
  try {
    status("Signed in. Preparing your profile…");
    const profile = await saveProfile(user);
    showSignedIn(user,profile);
    status("Welcome back, " + profile.display_name + "!");
    await Promise.all([loadPeople(),loadConversations(),loadFeed(),loadFriendRequests(),loadNotifications()]);
  } catch(e) {
    showSignedOut();
    status("Google sign-in worked, but the database connection needs attention: " + friendly(e),true);
  }
});
window.addEventListener("beforeunload",() => {
  if (messageChannel && db) db.removeChannel(messageChannel);
});
