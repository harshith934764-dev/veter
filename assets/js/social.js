import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, RecaptchaVerifier, signInWithPhoneNumber
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
let feedSortMode = "newest";
let presenceChannel = null;
let typingChannel = null;
let activeGroup = null;
let groupChannel = null;
let typingStopTimer = null;
let phoneRecaptcha = null;
let phoneConfirmation = null;

function status(message, error = false) {
  const appShell = $("social-app");
  const signedInView = appShell && !appShell.hidden;
  const node = signedInView ? $("app-status") : $("auth-status");
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
  if (error?.code === "auth/unauthorized-domain") return "This website is not authorized for login. Add theveter.in in Firebase Authentication → Settings → Authorized domains.";
  if (error?.code === "auth/popup-blocked") return "Your browser blocked the sign-in popup. Trying secure redirect login…";
  if (error?.code === "auth/operation-not-allowed") return "Google or phone sign-in is not enabled in Firebase Authentication yet.";
  if (error?.code === "auth/network-request-failed") return "Network error. Check your internet connection and try again.";
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
  $("my-veter-id").textContent = profile.veter_id || "ID will appear after refresh";
  $("profile-username").dataset.savedUsername = profile.username || "";
  renderProfilePreview();
}
async function startPresence() {
  const client = await getDb();
  if (presenceChannel) client.removeChannel(presenceChannel);
  presenceChannel = client.channel("veter-social-presence",{config:{presence:{key:me.uid}}});
  presenceChannel.on("presence",{event:"sync"},() => {
    const state = presenceChannel.presenceState();
    window.veterOnlineUsers = new Set(Object.keys(state));
    document.querySelectorAll("[data-online-user]").forEach(node => {
      const online = window.veterOnlineUsers.has(node.dataset.onlineUser);
      node.textContent = online ? "● Online" : "Offline";
      node.classList.toggle("is-online",online);
    });
  });
  await presenceChannel.subscribe(async state => { if (state === "SUBSCRIBED") await presenceChannel.track({uid:me.uid,online_at:new Date().toISOString()}); });
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
async function toggleFollow(uid) {
  if (!me || !uid || uid.startsWith("demo:")) return;
  const client = await getDb();
  const existing = (window.veterFollowRows || []).some(x=>x.follower_uid===me.uid && x.following_uid===uid);
  const result = existing
    ? await client.from("social_follows").delete().eq("follower_uid",me.uid).eq("following_uid",uid)
    : await client.from("social_follows").insert({follower_uid:me.uid,following_uid:uid});
  if (result.error) throw result.error;
  await loadPeople();
  status(existing ? "You unfollowed this member." : "You are now following this member.");
}
async function renderFollowingList() {
  const host=$("following-list"); if(!host || !me)return;
  const ids=(window.veterFollowRows||[]).filter(x=>x.follower_uid===me.uid).map(x=>x.following_uid);
  $("following-count").textContent=ids.length?String(ids.length):"";
  if(!ids.length){host.innerHTML='<p class="empty-state">You are not following anyone yet. Explore members and tap Follow.</p>';return;}
  const client=await getDb();
  const {data,error}=await client.from("user_profiles").select("uid,display_name,avatar_url,country,bio,username,is_verified").in("uid",ids);
  if(error)throw error;
  host.innerHTML=(data||[]).map(p=>'<article class="person-card"><img src="'+avatar(p)+'" alt=""><div class="person-info"><b>'+esc(p.display_name)+'</b><small>'+(p.username?'@'+esc(p.username):esc(p.country||'Veter member'))+'</small><p>'+esc(p.bio||'')+'</p></div><div class="person-actions"><button data-unfollow-user="'+esc(p.uid)+'">Unfollow</button><button data-chat-user="'+esc(p.uid)+'">Message</button></div></article>').join("");
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


let selectedVibeMedia = null;
let viewingVibe = null;
let showingVibeArchive = false;

async function loadVibePrivacy() {
  const client = await getDb();
  const {data,error} = await client.from("social_story_privacy").select("*").eq("user_uid",me.uid).maybeSingle();
  if (error) throw error;
  $("vibe-reply-setting").value = data?.allow_replies || "friends";
  $("vibe-visibility").value = data?.default_visibility || "friends";
}
async function saveVibePrivacy() {
  try {
    const client = await getDb();
    const {error} = await client.from("social_story_privacy").upsert({
      user_uid:me.uid, default_visibility:$("vibe-visibility").value,
      allow_replies:$("vibe-reply-setting").value, updated_at:new Date().toISOString()
    },{onConflict:"user_uid"});
    if(error) throw error;
    status("Veter Vibes privacy settings saved.");
  } catch(e) { status(friendly(e),true); }
}
async function loadVibeCircle() {
  const client = await getDb();
  const {data:rows,error} = await client.from("social_close_friends").select("friend_uid").eq("owner_uid",me.uid);
  if(error) throw error;
  const ids=(rows||[]).map(r=>r.friend_uid);
  if(!ids.length){$("vibe-circle-list").innerHTML='<small class="vibe-note">Your close circle is empty. Add trusted friends by username.</small>';return;}
  const {data:people,error:pe}=await client.from("user_profiles").select("uid,display_name,username").in("uid",ids);
  if(pe) throw pe;
  $("vibe-circle-list").innerHTML=(people||[]).map(p=>'<span class="vibe-circle-chip">'+esc(p.display_name)+' · @'+esc(p.username||"member")+' <button type="button" data-remove-circle="'+esc(p.uid)+'" aria-label="Remove from close circle">×</button></span>').join("");
}
async function manageVibeCircle() {
  const username=(prompt("Add a friend by Veter username (without @):")||"").trim().replace(/^@/,"").toLowerCase();
  if(!username) return;
  try {
    const client=await getDb();
    const {data:p,error}=await client.from("user_profiles").select("uid,username").eq("username",username).maybeSingle();
    if(error) throw error;
    if(!p || p.uid===me.uid){status("That Veter username was not found.",true);return;}
    const {data:friend,error:fe}=await client.from("social_friend_requests").select("id").eq("status","accepted").or("and(sender_uid.eq."+me.uid+",receiver_uid.eq."+p.uid+"),and(sender_uid.eq."+p.uid+",receiver_uid.eq."+me.uid+")").limit(1);
    if(fe) throw fe;
    if(!friend?.length){status("Only accepted Veter friends can join your close circle.",true);return;}
    const {error:saveError}=await client.from("social_close_friends").insert({owner_uid:me.uid,friend_uid:p.uid});
    if(saveError && saveError.code!=="23505") throw saveError;
    await loadVibeCircle();status("Added @"+username+" to your close circle.");
  } catch(e){status(friendly(e),true);}
}
async function removeVibeCircle(uid) {
  try {const client=await getDb();const {error}=await client.from("social_close_friends").delete().eq("owner_uid",me.uid).eq("friend_uid",uid);if(error)throw error;await loadVibeCircle();status("Removed from your close circle.");}
  catch(e){status(friendly(e),true);}
}
function clearVibeMedia() { selectedVibeMedia=null; $("vibe-media").value=""; $("vibe-file-name").textContent="No media selected · max 50 MB"; }
async function publishVibe(event) {
  event.preventDefault();
  const caption=$("vibe-caption").value.trim();
  const file=selectedVibeMedia;
  const question=$("vibe-poll-question").value.trim();
  const optionsText=$("vibe-poll-options").value.trim();
  const options=optionsText ? optionsText.split(",").map(x=>x.trim()).filter(Boolean) : null;
  if(!file && !caption && !question){status("Add a photo, video, caption or poll first.",true);return;}
  if(question && (!options || options.length<2 || options.length>4)){status("A poll needs 2–4 options separated by commas.",true);return;}
  if(!question && options){status("Add a poll question or clear the poll options.",true);return;}
  const button=$("vibe-form").querySelector('button[type="submit"]');button.disabled=true;
  let mediaPath=null,mediaType="text";
  try{
    const client=await getDb();
    if(file){
      const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
      mediaPath=me.uid+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError}=await client.storage.from("veter-vibes").upload(mediaPath,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      mediaType=file.type.startsWith("video/")?"video":"image";
    }
    const {error}=await client.from("social_stories").insert({
      author_uid:me.uid,media_path:mediaPath,media_type:mediaType,caption,
      visibility:$("vibe-visibility").value,poll_question:question||null,poll_options:options
    });
    if(error)throw error;
    $("vibe-caption").value="";$("vibe-poll-question").value="";$("vibe-poll-options").value="";clearVibeMedia();
    await loadVibes();status("Your Vibe is live for 24 hours! ✨");
  }catch(e){status(friendly(e),true);}
  finally{button.disabled=false;}
}
async function loadVibes() {
  try{
    const client=await getDb();const now=new Date().toISOString();
    let query=client.from("social_stories").select("*").order("created_at",{ascending:false}).limit(100);
    query=showingVibeArchive?query.eq("author_uid",me.uid).or("expires_at.lt."+now+",archived_at.not.is.null"):query.gt("expires_at",now).is("archived_at",null);
    const {data:stories,error}=await query;if(error)throw error;
    const ids=[...new Set((stories||[]).map(s=>s.author_uid))];
    const {data:profiles,error:pe}=ids.length?await client.from("user_profiles").select("uid,display_name,avatar_url,username").in("uid",ids):{data:[],error:null};
    if(pe)throw pe;const byId=new Map((profiles||[]).map(p=>[p.uid,p]));
    const paths=(stories||[]).filter(s=>s.media_path).map(s=>s.media_path);
    const urls={};
    for(const path of paths){const {data}=await client.storage.from("veter-vibes").createSignedUrl(path,3600);if(data?.signedUrl)urls[path]=data.signedUrl;}
    $("vibe-count").textContent=stories?.length?String(stories.length):"";
    $("vibe-list-title").textContent=showingVibeArchive?"Your private archive":"Fresh Vibes";
    $("vibe-archive-toggle").textContent=showingVibeArchive?"← Back to Vibes":"📦 My archive";
    if(!stories?.length){$("vibe-list").innerHTML='<p class="empty-state">'+(showingVibeArchive?"Your archive is empty.":"No Vibes yet. Share the first moment!")+'</p>';return;}
    $("vibe-list").innerHTML=stories.map(s=>{
      const p=byId.get(s.author_uid)||{display_name:"Veter member"};
      const media=urls[s.media_path];
      const preview=media?(s.media_type==="video"?'<video muted playsinline src="'+esc(media)+'"></video>':'<img src="'+esc(media)+'" alt="">'):'';
      return '<button class="vibe-card" type="button" data-open-vibe="'+esc(s.id)+'">'+preview+'<img class="vibe-avatar" src="'+avatar(p)+'" alt=""><span class="vibe-card-copy"><b>'+esc(p.display_name)+'</b><small>'+esc(s.caption||s.poll_question||"Shared a Vibe")+'</small><small>'+(showingVibeArchive?"Archived":"Expires "+new Date(s.expires_at).toLocaleTimeString())+'</small></span></button>';
    }).join("");
  }catch(e){status(friendly(e),true);}
}
async function openVibe(id) {
  try{
    const client=await getDb();
    const {data:s,error}=await client.from("social_stories").select("*").eq("id",id).single();if(error)throw error;
    viewingVibe=s;
    const {data:p,error:pe}=await client.from("user_profiles").select("uid,display_name,avatar_url").eq("uid",s.author_uid).single();if(pe)throw pe;
    let media="";
    if(s.media_path){const {data,error:se}=await client.storage.from("veter-vibes").createSignedUrl(s.media_path,3600);if(se)throw se;media=s.media_type==="video"?'<video class="vibe-media" controls playsinline src="'+esc(data.signedUrl)+'"></video>':'<img class="vibe-media" src="'+esc(data.signedUrl)+'" alt="Vibe media">';}
    if(s.author_uid!==me.uid && new Date(s.expires_at)>new Date()){
      await client.from("social_story_views").upsert({story_id:s.id,viewer_uid:me.uid,viewed_at:new Date().toISOString()},{onConflict:"story_id,viewer_uid",ignoreDuplicates:true});
    }
    const [{data:reactions,error:re},{data:votes,error:ve},{data:replies,error:repe}]=await Promise.all([
      client.from("social_story_reactions").select("reaction,user_uid").eq("story_id",id),
      client.from("social_story_votes").select("option_index,voter_uid").eq("story_id",id),
      client.from("social_story_replies").select("sender_uid,body,created_at").eq("story_id",id).order("created_at").limit(30)
    ]);
    if(re)throw re;if(ve)throw ve;if(repe)throw repe;
    const mine=(reactions||[]).find(x=>x.user_uid===me.uid);
    const isOwner=s.author_uid===me.uid;
    let poll="";
    if(s.poll_options?.length){
      const myVote=(votes||[]).find(v=>v.voter_uid===me.uid);
      poll='<div class="vibe-poll"><b>📊 '+esc(s.poll_question)+'</b>'+s.poll_options.map((o,i)=>'<button type="button" data-vibe-vote="'+i+'" '+(myVote?"disabled":"")+'>'+esc(o)+' · '+(votes||[]).filter(v=>v.option_index===i).length+' votes</button>').join("")+'</div>';
    }
    const viewerCount=isOwner?await client.from("social_story_views").select("viewer_uid",{count:"exact",head:true}).eq("story_id",id):{count:null};
    const viewers=isOwner?'<div class="vibe-viewers">👀 '+(viewerCount.count||0)+' viewers</div>':"";
    const reactionsBar=isOwner?'<div class="vibe-viewers">Reactions: '+(reactions||[]).map(x=>esc(x.reaction)).join(" ")+'</div>':"";
    const replyForm=!isOwner && s.expires_at>new Date().toISOString()?'<form class="vibe-reply-form" id="vibe-reply-form"><input id="vibe-reply-text" maxlength="500" placeholder="Reply privately to this Vibe…" required><button type="submit">Send</button></form>':"";
    $("vibe-viewer").innerHTML='<div class="vibe-viewer-head"><img src="'+avatar(p)+'" alt=""><div><b>'+esc(p.display_name)+'</b><small>'+new Date(s.created_at).toLocaleString()+'</small></div><button class="vibe-close" type="button" id="vibe-close-viewer">Close</button></div>'+media+'<p class="vibe-caption">'+esc(s.caption)+'</p>'+poll+(isOwner?"":'<div class="vibe-actions">'+["❤️","😂","🔥","😍","👏","😮"].map(x=>'<button type="button" data-vibe-react="'+x+'" '+(mine?"disabled":"")+'>'+x+'</button>').join("")+'</div>')+replyForm+'<div class="vibe-replies">'+(replies||[]).map(r=>'<p>'+esc(r.body)+' <small>· '+new Date(r.created_at).toLocaleTimeString()+'</small></p>').join("")+'</div>'+viewers+reactionsBar+(isOwner?'<div class="vibe-actions"><button type="button" id="vibe-delete-story">Delete Vibe</button></div>':"");
    $("vibe-viewer").hidden=false;$("vibe-viewer").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){status(friendly(e),true);}
}
async function reactToVibe(reaction) {
  if(!viewingVibe)return;
  try{const client=await getDb();const {error}=await client.from("social_story_reactions").insert({story_id:viewingVibe.id,user_uid:me.uid,reaction});if(error && error.code!=="23505")throw error;await openVibe(viewingVibe.id);}
  catch(e){status(friendly(e),true);}
}
async function voteOnVibe(optionIndex) {
  if(!viewingVibe)return;
  try{const client=await getDb();const {error}=await client.from("social_story_votes").insert({story_id:viewingVibe.id,voter_uid:me.uid,option_index:optionIndex});if(error)throw error;await openVibe(viewingVibe.id);status("Your vote has been counted!");}
  catch(e){status(friendly(e),true);}
}
async function replyToVibe(event) {
  event.preventDefault();if(!viewingVibe)return;
  const body=$("vibe-reply-text").value.trim();if(!body)return;
  try{const client=await getDb();const {error}=await client.from("social_story_replies").insert({story_id:viewingVibe.id,sender_uid:me.uid,body});if(error)throw error;await openVibe(viewingVibe.id);status("Your reply was sent.");}
  catch(e){status(friendly(e),true);}
}
async function deleteVibe() {
  if(!viewingVibe || !confirm("Delete this Vibe permanently?"))return;
  try{const client=await getDb();if(viewingVibe.media_path)await client.storage.from("veter-vibes").remove([viewingVibe.media_path]);const {error}=await client.from("social_stories").delete().eq("id",viewingVibe.id);if(error)throw error;$("vibe-viewer").hidden=true;viewingVibe=null;await loadVibes();status("Vibe deleted.");}
  catch(e){status(friendly(e),true);}
}


async function loadDating() {
 const host=$("dating-people"); if(!me||!host)return;
 try {
  const client=await getDb();
  const {data:elig,error:eligError}=await client.from("dating_eligibility").select("birth_date,adult_confirmed").eq("uid",me.uid).maybeSingle();
  if(eligError)throw eligError;
  if(elig){$("dating-birth-date").value=elig.birth_date;$("dating-adult-confirm").checked=elig.adult_confirmed;}
  const {data:mine,error:mineError}=await client.from("dating_profiles").select("*").eq("uid",me.uid).maybeSingle();
  if(mineError)throw mineError;
  if(mine){$("dating-looking-for").value=mine.looking_for;$("dating-city").value=mine.city;$("dating-headline").value=mine.headline;$("dating-interests").value=(mine.interests||[]).join(", ");$("dating-enable").checked=mine.dating_enabled;}
  if(!elig || !elig.adult_confirmed){host.innerHTML='<p class="empty-state">Dating is locked. Enter your date of birth and confirm you are 18+.</p>';return;}
  const {data:cards,error}=await client.from("dating_profiles").select("uid,headline,city,interests,looking_for").eq("dating_enabled",true).neq("uid",me.uid).order("updated_at",{ascending:false}).limit(40);
  if(error)throw error;
  const ids=(cards||[]).map(x=>x.uid);
  const {data:likes,error:likesError}=await client.from("dating_likes").select("sender_uid,receiver_uid").or(`sender_uid.eq.${me.uid},receiver_uid.eq.${me.uid}`);
  if(likesError)throw likesError;
  const liked=new Set((likes||[]).filter(x=>x.sender_uid===me.uid).map(x=>x.receiver_uid));
  const mutual=(likes||[]).filter(x=>x.receiver_uid===me.uid && liked.has(x.sender_uid));
  const mutualIds=mutual.map(x=>x.sender_uid);
  if(mutualIds.length){const {data:mp}=await client.from("user_profiles").select("uid,display_name").in("uid",mutualIds);$("dating-matches").hidden=false;$("dating-matches").textContent="💞 You have "+mutualIds.length+" mutual match(es): "+(mp||[]).map(x=>x.display_name).join(", ");}else{$("dating-matches").hidden=true;}
  if(!ids.length){host.innerHTML='<p class="empty-state">No eligible dating profiles yet. Invite adults you know to join Veter.</p>';return;}
  const {data:profiles,error:profileError}=await client.from("user_profiles").select("uid,display_name,avatar_url,country,username").in("uid",ids);
  if(profileError)throw profileError;
  const byId=new Map((profiles||[]).map(x=>[x.uid,x]));
  host.innerHTML=cards.filter(x=>byId.has(x.uid)).map(card=>{const p=byId.get(card.uid);return '<article class="person-card dating-person-card"><img src="'+avatar(p)+'" alt=""><div class="person-info"><b>'+esc(p.display_name)+'</b><small>'+esc([card.city||p.country,card.looking_for].filter(Boolean).join(' · '))+'</small><p>'+esc(card.headline||'Open to meeting someone new.')+'</p><small>'+esc((card.interests||[]).join(' · '))+'</small></div><div class="person-actions"><button data-dating-like="'+esc(card.uid)+'" '+(liked.has(card.uid)?'disabled':'')+'>'+(liked.has(card.uid)?'Liked ✓':'❤️ Like')+'</button></div></article>';}).join("")||'<p class="empty-state">No profiles to show right now.</p>';
 } catch(e){status(friendly(e),true);host.innerHTML='<p class="empty-state">Could not load dating profiles. Please try again.</p>';}
}
async function saveDatingProfile(event){
 event.preventDefault();
 const dob=$("dating-birth-date").value;
 if(!$("dating-adult-confirm").checked){status("Dating is only for adults 18+. Please confirm your age.",true);return;}
 if(!dob){status("Enter your date of birth.",true);return;}
 const ageDate=new Date(dob+"T00:00:00");const cutoff=new Date();cutoff.setFullYear(cutoff.getFullYear()-18);
 if(Number.isNaN(ageDate.getTime())||ageDate>cutoff){status("Veter Dating is only available to people aged 18 or older.",true);return;}
 try{
  const client=await getDb();
  const {error:eligError}=await client.from("dating_eligibility").upsert({uid:me.uid,birth_date:dob,adult_confirmed:true,updated_at:new Date().toISOString()},{onConflict:"uid"});
  if(eligError)throw eligError;
  const interests=$("dating-interests").value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
  const {error}=await client.from("dating_profiles").upsert({uid:me.uid,dating_enabled:$("dating-enable").checked,headline:$("dating-headline").value.trim(),city:$("dating-city").value.trim(),interests,looking_for:$("dating-looking-for").value,updated_at:new Date().toISOString()},{onConflict:"uid"});
  if(error)throw error;
  status("Dating profile saved. Your date of birth stays private.");await loadDating();
 }catch(e){status(friendly(e),true);}
}
async function sendDatingLike(uid){
 try{const client=await getDb();const {error}=await client.from("dating_likes").insert({sender_uid:me.uid,receiver_uid:uid});if(error && error.code!=="23505")throw error;status("Like sent. If they like you back, you’ll match!");await loadDating();}
 catch(e){status(friendly(e),true);}
}

function switchView(name) {
  document.querySelectorAll(".social-tab").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.querySelectorAll(".social-view").forEach(v => v.hidden = v.id !== "view-" + name);
  if (name === "feed") loadFeed();
  if (name === "chats") loadConversations();
  if (name === "dating") loadDating();
  if (name === "discover") loadPeople();
  if (name === "friends") loadFriendRequests();
  if (name === "notifications") loadNotifications();
  if (name === "saved") loadFeed("saved-list",true);
  if (name === "vibes") { loadVibes(); loadVibePrivacy(); loadVibeCircle(); }
}

async function loadPeople() {
  try {
    const client = await getDb();
    const [{data: profiles,error}, {data: blocks,error: blockError}, {data: requests,error: requestError}, {data: demoProfiles,error: demoError}, {data: followRows,error: followError}] = await Promise.all([
      client.from("user_profiles").select("uid,display_name,avatar_url,country,bio,username,is_verified").neq("uid",me.uid).order("updated_at",{ascending:false}).limit(60),
      client.from("blocks").select("blocked_uid").eq("blocker_uid",me.uid),
      client.from("social_friend_requests").select("id,sender_uid,receiver_uid,status").or(`sender_uid.eq.${me.uid},receiver_uid.eq.${me.uid}`),
      client.from("social_demo_profiles").select("id,display_name,avatar_url,country,city,bio,username,is_demo").eq("is_demo",true).limit(30),
      client.from("social_follows").select("follower_uid,following_uid")
    ]);
    if (error) throw error; if (blockError) throw blockError; if (requestError) throw requestError;
    if (demoError) throw demoError; if (followError) throw followError;
    window.veterFollowRows = followRows || [];
    const blocked = new Set((blocks || []).map(x => x.blocked_uid));
    const realProfiles = (profiles || []).filter(p => !blocked.has(p.uid));
    const previews = (demoProfiles || []).map(p => ({...p,uid:"demo:"+p.id,is_demo:true}));
    cachedPeople = [...realProfiles,...previews];
    window.veterFriendRequests = requests || [];
    renderPeople(cachedPeople);
    renderFollowingList();
  } catch (e) { status(friendly(e), true); }
}
function renderPeople(profiles) {
  const host = $("people-list");
  if (!profiles.length) { host.innerHTML = '<p class="empty-state">No other profiles yet. Invite a friend to join Veter Social.</p>'; return; }
  const sortedProfiles = [...profiles].sort((a,b) =>
    Number(!!b.country && b.country === $("profile-country").value.trim()) -
    Number(!!a.country && a.country === $("profile-country").value.trim())
  );
  const follows = window.veterFollowRows || [];
  const followed = new Set(follows.filter(x=>x.follower_uid===me.uid).map(x=>x.following_uid));
  const followerCounts = new Map();
  for (const row of follows) followerCounts.set(row.following_uid,(followerCounts.get(row.following_uid)||0)+1);
  host.innerHTML = sortedProfiles.map(p => {
    const isFollowing = followed.has(p.uid);
    const actions = p.is_demo
      ? '<span class="demo-preview-label">Preview only</span>'
      : '<button data-follow-user="'+esc(p.uid)+'">'+(isFollowing ? 'Following ✓' : '＋ Follow')+'</button><button data-friend-user="'+esc(p.uid)+'">Add friend</button><button data-chat-user="'+esc(p.uid)+'">Message</button>';
    return '<article class="person-card '+(p.is_demo ? 'demo-person-card' : '')+'"><img src="'+avatar(p)+'" alt="" loading="lazy"><div class="person-info"><b>'+esc(p.display_name)+(p.is_verified ? ' <span class="verified-badge">✓</span>' : '')+(p.is_demo ? ' <span class="demo-profile-badge">DEMO</span>' : '')+'</b><small>'+esc([p.username ? '@'+p.username : '',p.city || p.country].filter(Boolean).join(' · ') || 'Veter member')+'</small>'+(p.is_demo ? '<small class="demo-note">Fictional preview profile · not a real user</small>' : '<small data-online-user="'+esc(p.uid)+'" class="presence-label">Checking status…</small>')+'<p>'+esc(p.bio || 'Ready to meet new people.')+'</p><small class="follow-count">'+(followerCounts.get(p.uid)||0)+' followers</small></div><div class="person-actions">'+actions+'</div></article>';
  }).join("");
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
    await client.from("messages").update({seen_at:new Date().toISOString()}).eq("conversation_id",conversation.id).neq("sender_uid",me.uid).is("seen_at",null);
    subscribeMessages();
    subscribeTyping();
    await loadConversations();
    $("message-input").focus();
    status("Private conversation opened.");
  } catch (e) { status(friendly(e), true); }
}

// Veter AI companion demo: fictional personas with transparent AI labels.
// Replies are local starter responses; connect a trusted model API for generative chat.
const aiCharacters = [
 {id:"ananya",name:"Ananya",gender:"Girl",topic:"Movies · Music · Daily talk",avatar:"https://api.dicebear.com/9.x/avataaars/svg?seed=Ananya&backgroundColor=b6e3f4",hello:"Hey! I’m Ananya 😊 I love movies, music and friendly conversations. What’s on your mind?"},
 {id:"arjun",name:"Arjun",gender:"Boy",topic:"Technology · Coding · Cricket",avatar:"https://api.dicebear.com/9.x/avataaars/svg?seed=Arjun&backgroundColor=c0aede",hello:"Hey! Arjun here 👋 Want to talk coding, new tech or cricket?"},
 {id:"pooja",name:"Pooja",gender:"Girl",topic:"Study · Career · Life advice",avatar:"https://api.dicebear.com/9.x/avataaars/svg?seed=Pooja&backgroundColor=ffd5dc",hello:"Hi there! I’m Pooja 🌸 We can talk about studies, careers or whatever’s on your mind."},
 {id:"karthik",name:"Karthik",gender:"Boy",topic:"Gaming · Anime · Fun",avatar:"https://api.dicebear.com/9.x/avataaars/svg?seed=Karthik&backgroundColor=d1d4f9",hello:"Yo! Karthik here 🎮 Anime, games or memes? Let’s go!"},
 {id:"meera",name:"Meera",gender:"Girl",topic:"Books · Travel · Self-care",avatar:"https://api.dicebear.com/9.x/avataaars/svg?seed=Meera&backgroundColor=ffdfbf",hello:"Hello! I’m Meera 🌼 Tell me what you’re reading or where you dream of travelling."},
 {id:"rohan",name:"Rohan",gender:"Boy",topic:"Fitness · Sports · Motivation",avatar:"https://api.dicebear.com/9.x/avataaars/svg?seed=Rohan&backgroundColor=b6e3f4",hello:"Hey! Rohan here 💪 Want to chat fitness, sports or goals?"},
 {id:"ishita",name:"Ishita",gender:"Girl",topic:"Movies · Food · Daily talk",avatar:"https://api.dicebear.com/9.x/avataaars/svg?seed=Ishita&backgroundColor=ffd5dc",hello:"Hii! I’m Ishita ✨ What did you eat today? Or shall we talk movies?"},
 {id:"vikram",name:"Vikram",gender:"Boy",topic:"Business · Startups · AI",avatar:"https://api.dicebear.com/9.x/avataaars/svg?seed=Vikram&backgroundColor=c0aede",hello:"Hello! Vikram here 🚀 Let’s talk startups, business ideas or AI."}
];
let activeAiCharacter = aiCharacters[0];
const aiChatHistory = Object.fromEntries(aiCharacters.map(c=>[c.id,[]]));
function renderAiRoster(){
 const host=$("ai-character-list"); if(!host)return;
 host.innerHTML=aiCharacters.map(c=>'<button type="button" class="ai-character '+(c.id===activeAiCharacter.id?'selected':'')+'" data-ai-character="'+c.id+'"><img src="'+c.avatar+'" alt=""><span><b>'+c.name+' <i>AI</i></b><small>'+c.topic+'</small></span><span class="ai-online-dot"></span></button>').join("");
}
function renderAiChat(){
 $("ai-active-name").textContent=activeAiCharacter.name;
 $("ai-active-avatar").src=activeAiCharacter.avatar;
 const rows=aiChatHistory[activeAiCharacter.id];
 $("ai-chat-messages").innerHTML='<div class="ai-welcome-card">'+activeAiCharacter.hello+'</div>'+rows.map(m=>'<div class="ai-message '+(m.from==="me"?"mine":"theirs")+'">'+esc(m.text)+'</div>').join("");
 $("ai-chat-messages").scrollTop=$("ai-chat-messages").scrollHeight;
 renderAiRoster();
}
function chooseAiCharacter(id){activeAiCharacter=aiCharacters.find(c=>c.id===id)||aiCharacters[0];renderAiChat();}
function aiStarterReply(message){
 const m=message.toLowerCase();
 if(/hello|hi|hey|hii/.test(m))return "Heyy! 😊 Nice to chat with you. What shall we talk about?";
 if(/movie|film|cinema|telugu/.test(m))return "Movie time! 🎬 You could try a Telugu comedy or a feel-good drama. What kind of stories do you enjoy?";
 if(/cricket|kohli|ipl/.test(m))return "Cricket talk! 🏏 What a game can teach us is patience, teamwork and staying calm under pressure. Which team do you support?";
 if(/code|coding|program|technology|tech|ai/.test(m))return "That’s a cool topic! 💻 Start with one small project, make it work, then improve it step by step. What are you building?";
 if(/study|exam|career|job/.test(m))return "One small step at a time 📚 Pick one clear task, focus for 25 minutes, then take a short break. What are you working towards?";
 if(/sad|stress|angry|upset|lonely/.test(m))return "I’m sorry it feels heavy right now. 💛 Take a slow breath. If you can, talk with someone you trust too. Want to tell me what happened?";
 if(/food|eat|lunch|dinner/.test(m))return "Food chat! 😋 What did you have today? I’m always ready to hear about a tasty meal.";
 if(/thank/.test(m))return "You’re welcome! 😊 Happy to keep chatting.";
 return "That sounds interesting! 😊 Tell me a little more. What part matters most to you?";
}
function sendAiMessage(event){
 event.preventDefault();const input=$("ai-message-input");const message=input.value.trim();if(!message)return;
 aiChatHistory[activeAiCharacter.id].push({from:"me",text:message});
 aiChatHistory[activeAiCharacter.id].push({from:"ai",text:aiStarterReply(message)});
 input.value="";renderAiChat();
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
const dailySparks = [["Small wins count 🌱","What is one small win you had today?"],["Teach us something 💡","What is one useful thing you learned recently?"],["Dream it. Build it. 🚀","If you could build one app, what would it do?"],["Your local story 🌍","What is one thing you love about your city?"],["Kindness challenge 💚","Share one kind thing someone did for you."]];
function renderDailySpark(){const spark=dailySparks[Math.floor(Date.now()/86400000)%dailySparks.length];$("daily-spark-title").textContent=spark[0];$("daily-spark-text").textContent=spark[1];}
function renderTrendingTopics(posts){const counts=new Map();for(const post of posts||[]){const tags=(String(post.body||"").toLowerCase().match(/#[\p{L}\p{N}_]{2,30}/gu)||[]);for(const tag of new Set(tags))counts.set(tag,(counts.get(tag)||0)+1);}const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8);$("trending-tags").innerHTML=top.length?top.map(([tag,count])=>'<button type="button" data-trending-tag="'+esc(tag)+'">'+esc(tag)+' <small>'+count+'</small></button>').join(""):'<span class="trending-empty">No hashtags yet. Add one to your next post!</span>';}
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
    if (hostId === "feed-list") renderTrendingTopics(posts);
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
    if (feedSortMode === "oldest") posts.sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
    if (feedSortMode === "popular") posts.sort((a,b) => (likes.filter(x=>x.post_id===b.id).length - likes.filter(x=>x.post_id===a.id).length) || (new Date(b.created_at)-new Date(a.created_at)));
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
        <div class="feed-actions"><button data-share-post>↗ Share</button><button data-like-post class="${likedBy.includes(me.uid) ? "liked" : ""}">${likedBy.includes(me.uid) ? "♥ Liked" : "♡ Like"} · ${likedBy.length}</button><button data-comment-post>💬 Comment · ${(commentsByPost.get(post.id) || []).length}</button><button data-save-post>${savedIds.has(post.id) ? "🔖 Saved" : "🔖 Save"}</button></div><div class="reaction-bar"><select data-reaction aria-label="Choose a reaction"><option value="">React…</option><option value="like" ${myReaction==="like"?"selected":""}>👍 Like</option><option value="love" ${myReaction==="love"?"selected":""}>❤️ Love</option><option value="haha" ${myReaction==="haha"?"selected":""}>😂 Haha</option><option value="wow" ${myReaction==="wow"?"selected":""}>😮 Wow</option><option value="sad" ${myReaction==="sad"?"selected":""}>😢 Sad</option><option value="angry" ${myReaction==="angry"?"selected":""}>😡 Angry</option></select><span>${(reactionsByPost.get(post.id)||[]).length} reactions</span></div>
        <form class="social-comment-form" data-comment-form hidden><textarea maxlength="500" rows="2" placeholder="Write a comment..." aria-label="Write a comment"></textarea><button type="submit">Post comment</button></form>
        <div class="post-comments">${(commentsByPost.get(post.id) || []).map(comment => {
          const commenter = byId.get(comment.author_uid) || {display_name:"Veter member"};
          return `<div class="post-comment"><b>${esc(commenter.display_name)}</b><span>${esc(comment.body)}</span><small>${new Date(comment.created_at).toLocaleString()}</small></div>`;
        }).join("") || '<p class="no-comments">No comments yet.</p>'}</div>
      </article>`;
    }).join("");
    applyFeedSearch();
  } catch (e) { host.innerHTML = '<p class="empty-state">Could not load posts.</p>'; status(friendly(e),true); }
}
function applyFeedSearch() {
  const field = $("feed-search");
  const host = $("feed-list");
  if (!field || !host) return;
  const q = field.value.trim().toLowerCase();
  let shown = 0;
  host.querySelectorAll("[data-post-id]").forEach(card => {
    const match = !q || card.textContent.toLowerCase().includes(q);
    card.hidden = !match;
    if (match) shown++;
  });
  $("feed-search-hint").textContent = q ? shown + " matching post(s) in the loaded feed." : "Search the posts currently loaded in your feed.";
}
function postDraftKey() { return me?.uid ? "veter-social-post-draft:" + me.uid : null; }
function savePostDraft() {
  const key = postDraftKey();
  if (!key) return;
  try {
    const body = $("post-body").value;
    if (body.trim()) localStorage.setItem(key, body);
    else localStorage.removeItem(key);
    $("post-draft-status").textContent = body.trim() ? "Draft saved on this device" : "Drafts save on this device";
  } catch {
    $("post-draft-status").textContent = "Draft saving unavailable";
  }
}
function restorePostDraft() {
  const key = postDraftKey();
  if (!key) return;
  try {
    const draft = localStorage.getItem(key);
    if (draft && !$("post-body").value.trim()) {
      $("post-body").value = draft;
      $("post-char-count").textContent = String(draft.length);
      $("post-draft-status").textContent = "Your draft was restored";
    }
  } catch { $("post-draft-status").textContent = "Draft saving unavailable"; }
}
function discardPostDraft() {
  const key = postDraftKey();
  try { if (key) localStorage.removeItem(key); } catch {}
  $("post-body").value = "";
  $("post-char-count").textContent = "0";
  $("post-draft-status").textContent = "Draft discarded";
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
    try { const key = postDraftKey(); if (key) localStorage.removeItem(key); } catch {}
    $("post-draft-status").textContent = "Post published";
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
  if (event.type === "click" && event.target.closest("[data-share-post]")) {
    const url = new URL("/social.html",location.origin);
    url.hash = "post-" + postId;
    const shareData = {title:"Veter Social post",text:"See this post on Veter Social",url:url.toString()};
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(url.toString()); status("Post link copied. Share it anywhere!"); }
    } catch(error) {
      if (error?.name !== "AbortError") {
        try { await navigator.clipboard.writeText(url.toString()); status("Post link copied. Share it anywhere!"); }
        catch { status("Could not share automatically. Copy this link: " + url.toString(),true); }
      }
    }
    return;
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
    const unreadByConversation = new Map();
    if (conversations.length) {
      const ids = conversations.map(c=>c.id);
      const {data:unread,error:unreadError} = await client.from("messages").select("conversation_id")
        .in("conversation_id",ids).neq("sender_uid",me.uid).is("seen_at",null);
      if (unreadError) throw unreadError;
      for (const m of unread || []) unreadByConversation.set(m.conversation_id,(unreadByConversation.get(m.conversation_id)||0)+1);
    }
    const unreadTotal = [...unreadByConversation.values()].reduce((a,b)=>a+b,0);
    $("chat-count").textContent = unreadTotal ? String(unreadTotal) : "";
    const host = $("chat-list");
    if (!conversations.length) { host.innerHTML = '<p class="empty-state">No conversations yet. Discover someone to say hello.</p>'; return; }
    host.innerHTML = conversations.map(c => {
      const id = c.participant_a === me.uid ? c.participant_b : c.participant_a;
      const p = byId.get(id) || {display_name:"Veter member"};
      const unread = unreadByConversation.get(c.id)||0;
      return `<button class="chat-list-item" data-open-chat="${esc(id)}"><img src="${avatar(p)}" alt=""><span><b>${esc(p.display_name)}</b><small>${new Date(c.last_message_at || c.created_at).toLocaleString()}</small></span>${unread ? `<em class="chat-unread-count">${unread}</em>` : ""}</button>`;
    }).join("");
  } catch (e) { status(friendly(e), true); }
}
let messageReactionCache = new Map();
async function loadMessages() {
  if (!activeConversation) return;
  const client = await getDb();
  const {data,error} = await client.from("messages").select("*")
    .eq("conversation_id",activeConversation.id).order("created_at",{ascending:true}).limit(200);
  if (error) throw error;
  const ids = (data || []).map(m => m.id);
  messageReactionCache = new Map();
  if (ids.length) {
    const {data: reactions,error: reactionError} = await client.from("message_reactions").select("message_id,user_uid,reaction").in("message_id",ids);
    if (reactionError) throw reactionError;
    for (const r of reactions || []) {
      if (!messageReactionCache.has(r.message_id)) messageReactionCache.set(r.message_id,[]);
      messageReactionCache.get(r.message_id).push(r);
    }
  }
  const host = $("chat-messages");
  host.innerHTML = (data || []).map(renderMessage).join("");
  host.scrollTop = host.scrollHeight;
}
function renderMessage(m) {
  const mine = m.sender_uid === me.uid;
  const reactions = messageReactionCache.get(m.id) || [];
  const summary = ["❤️","😂","👍","😮","😢","🔥"].map(emoji => {
    const matching = reactions.filter(r => r.reaction === emoji);
    return matching.length ? `<button type="button" class="message-reaction ${matching.some(r=>r.user_uid===me.uid)?"selected":""}" data-message-react="${esc(m.id)}" data-reaction="${emoji}" aria-label="React ${emoji}">${emoji} <span>${matching.length}</span></button>` : "";
  }).join("");
  return `<div class="message-row ${mine ? "mine" : ""}" data-message-id="${esc(m.id)}"><div class="message-bubble">${esc(m.body)}<small>${new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}${mine ? " · "+(m.seen_at ? "Seen ✓✓" : m.delivered_at ? "Delivered ✓✓" : "Sent ✓") : ""}</small><div class="message-reactions">${summary}<button type="button" class="message-react-add" data-message-react="${esc(m.id)}" data-reaction="❤️" aria-label="Add heart reaction">＋</button></div></div></div>`;
}
async function toggleMessageReaction(messageId, reaction) {
  if (!me || !activeConversation) return;
  const client = await getDb();
  const existing = (messageReactionCache.get(messageId) || []).find(r => r.user_uid === me.uid);
  if (existing?.reaction === reaction) {
    const {error} = await client.from("message_reactions").delete().eq("message_id",messageId).eq("user_uid",me.uid);
    if (error) throw error;
  } else {
    const {error} = await client.from("message_reactions").upsert({message_id:messageId,user_uid:me.uid,reaction},{onConflict:"message_id,user_uid"});
    if (error) throw error;
  }
  await loadMessages();
}
function subscribeTyping() {
  if (typingChannel && db) db.removeChannel(typingChannel);
  typingChannel = db.channel("veter-typing-"+activeConversation.id);
  typingChannel.on("broadcast",{event:"typing"},payload => {
    if (payload.payload?.uid !== me.uid) $("chat-presence").textContent = payload.payload?.typing ? "Typing…" : "Private chat";
  }).subscribe();
}
async function broadcastTyping(isTyping) {
  if (!typingChannel) return;
  await typingChannel.send({type:"broadcast",event:"typing",payload:{uid:me.uid,typing:isTyping}});
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
    }).on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:"conversation_id=eq."+activeConversation.id},() => loadMessages()).subscribe();
}
async function clientMarkDelivered(id) {
  try { const client = await getDb(); await client.from("messages").update({delivered_at:new Date().toISOString()}).eq("id",id); } catch {}
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
async function openSharedProfileIfRequested() {
  const params = new URLSearchParams(location.search);
  const username = (params.get("user") || "").replace(/^@/,"").toLowerCase();
  const veterId = params.get("veter");
  if (!username && !veterId) return;
  try {
    const client = await getDb();
    let query = client.from("user_profiles").select("uid,display_name,avatar_url,country,bio,username,is_verified");
    query = username ? query.eq("username",username) : query.eq("veter_id",veterId);
    const {data,error} = await query.maybeSingle();
    if (error) throw error;
    if (!data) { status("That shared Veter profile could not be found.",true); return; }
    switchView("discover");
    renderPeople([data]);
    status("You are viewing the shared profile of " + data.display_name + ".");
  } catch(e) { status(friendly(e),true); }
}
async function blockPartner() {
  if (!me || !activePartner?.uid) { status("Open a conversation first.", true); return; }
  const name = activePartner.display_name || "this person";
  if (!confirm("Block " + name + "? They will no longer be able to start conversations with you.")) return;
  const button = $("block-chat");
  button.disabled = true;
  try {
    const client = await getDb();
    const { error } = await client.from("blocks").upsert(
      { blocker_uid: me.uid, blocked_uid: activePartner.uid },
      { onConflict: "blocker_uid,blocked_uid" }
    );
    if (error) throw error;
    if (messageChannel) client.removeChannel(messageChannel);
    messageChannel = null;
    activeConversation = null;
    activePartner = null;
    $("active-chat").hidden = true;
    $("chat-empty").hidden = false;
    await Promise.all([loadPeople(), loadConversations()]);
    status(name + " has been blocked.");
  } catch (error) { status(friendly(error), true); }
  finally { button.disabled = false; }
}

async function reportPartner() {
  if (!me || !activePartner?.uid || !activeConversation?.id) {
    status("Open a conversation before reporting someone.", true); return;
  }
  const reason = prompt("Why are you reporting this person? (Spam, harassment, abuse, scam, or other)");
  if (!reason || !reason.trim()) return;
  const details = prompt("Add details about what happened (required):");
  if (!details || !details.trim()) {
    status("Please add a short explanation so the report can be reviewed.", true); return;
  }
  const button = $("report-chat");
  button.disabled = true;
  try {
    const client = await getDb();
    const { error } = await client.from("reports").insert({
      reporter_uid: me.uid,
      reported_uid: activePartner.uid,
      conversation_id: activeConversation.id,
      reason: reason.trim().slice(0,120),
      details: details.trim().slice(0,2000),
      status: "pending"
    });
    if (error) throw error;
    status("Report submitted. Thank you for helping keep Veter safe.");
  } catch (error) { status(friendly(error), true); }
  finally { button.disabled = false; }
}


function renderProfilePreview() {
  const name = $("profile-name").value.trim() || "Your name";
  const username = $("profile-username").value.trim().replace(/^@/,"").toLowerCase();
  const country = $("profile-country").value.trim();
  const bio = $("profile-bio").value.trim();
  const avatarUrl = $("profile-avatar").value.trim();
  $("profile-preview-name").textContent = name;
  $("profile-preview-username").textContent = username ? "@"+username : "@your_username";
  $("profile-preview-bio").textContent = bio || "Your introduction will appear here.";
  $("profile-preview-country").textContent = country || "Add your country";
  $("profile-preview-avatar").src = avatarUrl && /^https:\/\//i.test(avatarUrl) ? avatarUrl : $("my-avatar").src;
  const checks = [!!$("profile-name").value.trim(),/^[a-z0-9_]{3,24}$/.test(username),!!country,!!bio,!!avatarUrl];
  const percent = Math.round(checks.filter(Boolean).length / checks.length * 100);
  $("profile-progress-value").textContent = percent+"%";
  $("profile-progress-fill").style.width = percent+"%";
  $("profile-progress-label").textContent = percent===100 ? "Lovely! Your profile is complete." : "Add "+(checks.length-checks.filter(Boolean).length)+" more detail(s) to complete your profile.";
}

async function saveMyProfile(event) {
  event.preventDefault();
  if (!me) { status("Please sign in before saving your profile.", true); return; }
  const button = $("profile-form").querySelector('button[type="submit"]');
  const displayName = $("profile-name").value.trim();
  const username = $("profile-username").value.trim().replace(/^@/, "").toLowerCase();
  const country = $("profile-country").value.trim();
  const bio = $("profile-bio").value.trim();
  const avatarUrl = $("profile-avatar").value.trim();
  if (!displayName || displayName.length > 40) {
    status("Display name must be between 1 and 40 characters.", true); return;
  }
  if (username && !/^[a-z0-9_]{3,24}$/.test(username)) {
    status("Username must be 3–24 characters: lowercase letters, numbers or underscores.", true); return;
  }
  if (avatarUrl) {
    try { const parsed = new URL(avatarUrl); if (parsed.protocol !== "https:") throw new Error(); }
    catch { status("Profile photo must use a valid HTTPS URL.", true); return; }
  }
  button.disabled = true;
  try {
    const client = await getDb();
    const { data, error } = await client.from("user_profiles").update({
      display_name: displayName,
      username: username || null,
      country,
      bio,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString()
    }).eq("uid", me.uid).select().single();
    if (error) throw error;
    showSignedIn(me, data);
    status("Your Veter profile has been saved.");
    await loadPeople();
  } catch (error) {
    if (error?.code === "23505") status("That username is already taken. Please choose another.", true);
    else status(friendly(error), true);
  } finally {
    button.disabled = false;
  }
}

async function copyVeterId() {
  const id = $("my-veter-id").textContent.trim();
  if (!id || id.startsWith("Generating") || id.includes("refresh")) { status("Your Veter ID is still being prepared.",true); return; }
  try { await navigator.clipboard.writeText(id); status("Veter ID copied!"); } catch { status("Could not copy automatically. Select and copy your ID.",true); }
}
async function shareMyProfile() {
  const client = await getDb();
  const {data,error} = await client.from("user_profiles").select("username,veter_id").eq("uid",me.uid).single();
  if (error) { status(friendly(error),true); return; }
  const url = new URL("/social.html",location.origin);
  if (data.username) url.searchParams.set("user",data.username);
  else url.searchParams.set("veter",data.veter_id);
  try { await navigator.clipboard.writeText(url.toString()); status("Profile link copied. Share it with your friends!"); }
  catch { status(url.toString()); }
}
async function loadGroups() {
  const client = await getDb();
  const {data:members,error} = await client.from("social_group_members").select("group_id,role").eq("user_uid",me.uid);
  if (error) throw error;
  const ids = (members || []).map(x => x.group_id);
  if (!ids.length) { $("group-list").innerHTML = '<p class="empty-state">No groups yet. Create one with your friends.</p>'; return; }
  const {data:groups,error:groupError} = await client.from("social_groups").select("id,title,description").in("id",ids);
  if (groupError) throw groupError;
  $("group-list").innerHTML = (groups || []).map(g => `<button class="chat-list-item" data-open-group="${esc(g.id)}"><span><b>${esc(g.title)}</b><small>${esc(g.description || "Group chat")}</small></span></button>`).join("");
}
async function createGroup() {
  const title = prompt("Give your group a name (2–60 characters):");
  if (!title) return;
  const description = prompt("Short group description (optional):") || "";
  const names = (prompt("Add friends by Veter username, separated by commas (optional):") || "")
    .split(",").map(x => x.trim().replace(/^@/,"").toLowerCase()).filter(Boolean);
  try {
    const client = await getDb();
    const {data:group,error} = await client.from("social_groups").insert({owner_uid:me.uid,title:title.trim(),description:description.slice(0,240)}).select().single();
    if (error) throw error;
    const members = [{group_id:group.id,user_uid:me.uid,role:"owner"}];
    if (names.length) {
      const {data:profiles,error:profileError} = await client.from("user_profiles").select("uid,username").in("username",names);
      if (profileError) throw profileError;
      const {data:friendRows,error:friendError} = await client.from("social_friend_requests").select("sender_uid,receiver_uid").eq("status","accepted").or("sender_uid.eq."+me.uid+",receiver_uid.eq."+me.uid);
      if (friendError) throw friendError;
      const friendIds = new Set((friendRows||[]).map(r => r.sender_uid===me.uid ? r.receiver_uid : r.sender_uid));
      for (const p of profiles||[]) if (friendIds.has(p.uid)) members.push({group_id:group.id,user_uid:p.uid,role:"member"});
      const missing = names.filter(n => !(profiles||[]).some(p => p.username===n && friendIds.has(p.uid)));
      if (missing.length) status("Some usernames were skipped because they were not found or are not your accepted friends.");
    }
    const {error:memberError} = await client.from("social_group_members").insert(members);
    if (memberError) throw memberError;
    await loadGroups();
    await openGroup(group.id);
    status("Your group is ready!");
  } catch(e) { status(friendly(e),true); }
}
async function openGroup(id) {
  try {
    const client = await getDb();
    const {data:group,error} = await client.from("social_groups").select("*").eq("id",id).single();
    if (error) throw error;
    activeGroup = group;
    $("group-empty").hidden = true;
    $("active-group").hidden = false;
    $("group-chat-name").textContent = group.title;
    const {data:msgs,error:msgError} = await client.from("social_group_messages").select("*").eq("group_id",id).order("created_at").limit(200);
    if (msgError) throw msgError;
    $("group-messages").innerHTML = (msgs || []).map(m => `<div class="message-row ${m.sender_uid===me.uid ? "mine" : ""}"><div class="message-bubble">${esc(m.body)}<small>${new Date(m.created_at).toLocaleTimeString()}</small></div></div>`).join("");
    if (groupChannel) client.removeChannel(groupChannel);
    groupChannel = client.channel("veter-group-"+id).on("postgres_changes",{event:"INSERT",schema:"public",table:"social_group_messages",filter:"group_id=eq."+id},payload => {
      const m = payload.new;
      const node = document.createElement("div");
      node.className = "message-row " + (m.sender_uid===me.uid ? "mine" : "");
      node.innerHTML = `<div class="message-bubble">${esc(m.body)}<small>${new Date(m.created_at).toLocaleTimeString()}</small></div>`;
      $("group-messages").appendChild(node);
    }).subscribe();
    switchView("groups");
  } catch(e) { status(friendly(e),true); }
}
async function sendGroupMessage(event) {
  event.preventDefault();
  const body = $("group-message-input").value.trim();
  if (!body || !activeGroup) return;
  try {
    const client = await getDb();
    const {error} = await client.from("social_group_messages").insert({group_id:activeGroup.id,sender_uid:me.uid,body});
    if (error) throw error;
    $("group-message-input").value = "";
  } catch(e) { status(friendly(e),true); }
}

$("google-sign-in").addEventListener("click", async () => {
  const button = $("google-sign-in");
  button.disabled = true;
  status("Opening secure Google sign-in…");
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked") {
        status("Popup blocked. Switching to redirect sign-in…");
        await signInWithRedirect(auth, provider);
        return;
      }
      throw error;
    }
  } catch(error) {
    status(friendly(error),true);
    button.disabled = false;
  }
});
getRedirectResult(auth).catch(error => {
  status(friendly(error),true);
});
async function ensurePhoneRecaptcha() {
  if (phoneRecaptcha) return phoneRecaptcha;
  phoneRecaptcha = new RecaptchaVerifier(auth, "phone-recaptcha", { size:"normal" });
  await phoneRecaptcha.render();
  return phoneRecaptcha;
}
$("phone-send-form").addEventListener("submit", async event => {
  event.preventDefault();
  const phone = $("phone-number").value.trim().replace(/[\s()-]/g,"");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    status("Enter your full phone number with country code, like +91 9876543210.",true);
    return;
  }
  const button = $("phone-send-code");
  button.disabled = true;
  try {
    status("Preparing secure phone verification…");
    const verifier = await ensurePhoneRecaptcha();
    phoneConfirmation = await signInWithPhoneNumber(auth,phone,verifier);
    $("phone-verify-form").hidden = false;
    $("phone-code").focus();
    status("SMS code sent. Check your phone.");
  } catch(error) {
    if (phoneRecaptcha) { try { await phoneRecaptcha.clear(); } catch {} phoneRecaptcha = null; }
    status(friendly(error),true);
  } finally { button.disabled = false; }
});
$("phone-verify-form").addEventListener("submit",async event => {
  event.preventDefault();
  const code = $("phone-code").value.trim();
  if (!phoneConfirmation || !/^\d{6}$/.test(code)) {
    status("Enter the 6-digit code sent to your phone.",true);
    return;
  }
  const button = $("phone-verify-code");
  button.disabled = true;
  try {
    status("Checking your code…");
    await phoneConfirmation.confirm(code);
    status("Phone verified. Opening Veter Social…");
  } catch(error) { status(friendly(error),true); }
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
$("ai-character-list").addEventListener("click",e=>{const b=e.target.closest("[data-ai-character]");if(b)chooseAiCharacter(b.dataset.aiCharacter);});
$("ai-message-form").addEventListener("submit",sendAiMessage);
$("ai-prompts").addEventListener("click",e=>{const b=e.target.closest("[data-ai-prompt]");if(b){$("ai-message-input").value=b.dataset.aiPrompt;$("ai-message-form").requestSubmit();}});
renderDailySpark();renderAiRoster();renderAiChat();
$("following-list").addEventListener("click",e=>{const b=e.target.closest("[data-unfollow-user]");if(b)toggleFollow(b.dataset.unfollowUser).catch(err=>status(friendly(err),true));else {const chat=e.target.closest("[data-chat-user]");if(chat)openConversation(chat.dataset.chatUser);}});
$("following-refresh")?.addEventListener("click",()=>loadPeople());
$("people-list").addEventListener("click",e => {
  const followButton=e.target.closest("[data-follow-user]");
  if(followButton){toggleFollow(followButton.dataset.followUser).catch(err=>status(friendly(err),true));return;}
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
$("chat-messages").addEventListener("click",e=>{
  const b=e.target.closest("[data-message-react]");
  if(!b)return;
  toggleMessageReaction(b.dataset.messageReact,b.dataset.reaction).catch(err=>status(friendly(err),true));
});
$("post-form").addEventListener("submit",publishPost);
$("feed-sort")?.addEventListener("change",e=>{feedSortMode=e.target.value;loadFeed();});
$("feed-refresh")?.addEventListener("click",()=>loadFeed());
$("feed-search")?.addEventListener("input",applyFeedSearch);
$("trending-tags")?.addEventListener("click",e=>{const b=e.target.closest("[data-trending-tag]");if(!b)return;switchView("feed");$("feed-search").value=b.dataset.trendingTag;applyFeedSearch();});
$("use-daily-spark")?.addEventListener("click",()=>{$("post-body").value=$("daily-spark-text").textContent+"\n\n";$("post-char-count").textContent=String($("post-body").value.length);$("post-body").focus();$("post-body").scrollIntoView({behavior:"smooth",block:"center"});});
$("feed-search-clear")?.addEventListener("click",()=>{$("feed-search").value="";applyFeedSearch();$("feed-search").focus();});
$("feed-list").addEventListener("click",handleFeedAction);
$("feed-list").addEventListener("change",handleFeedAction);
$("feed-list").addEventListener("submit",handleFeedAction);
$("saved-list").addEventListener("click",handleFeedAction);
$("saved-list").addEventListener("change",handleFeedAction);
$("saved-list").addEventListener("submit",handleFeedAction);
$("post-body").addEventListener("input",e => { $("post-char-count").textContent = String(e.target.value.length); savePostDraft(); });
$("discard-post-draft")?.addEventListener("click",discardPostDraft);
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

$("vibe-form").addEventListener("submit",publishVibe);
$("vibe-media").addEventListener("change",e=>{
 const f=e.target.files?.[0];if(!f){clearVibeMedia();return;}
 const ok=["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"];
 if(!ok.includes(f.type)||f.size>50*1024*1024){clearVibeMedia();status("Choose an image or video up to 50 MB.",true);return;}
 selectedVibeMedia=f;$("vibe-file-name").textContent=f.name;
});
$("vibe-archive-toggle").addEventListener("click",()=>{showingVibeArchive=!showingVibeArchive;$("vibe-viewer").hidden=true;loadVibes();});
$("vibe-close-circle").addEventListener("click",manageVibeCircle);
$("vibe-save-settings").addEventListener("click",saveVibePrivacy);
$("vibe-circle-list").addEventListener("click",e=>{const b=e.target.closest("[data-remove-circle]");if(b)removeVibeCircle(b.dataset.removeCircle);});
$("vibe-list").addEventListener("click",e=>{const b=e.target.closest("[data-open-vibe]");if(b)openVibe(b.dataset.openVibe);});
$("vibe-viewer").addEventListener("click",e=>{
 const react=e.target.closest("[data-vibe-react]");if(react)reactToVibe(react.dataset.vibeReact);
 const vote=e.target.closest("[data-vibe-vote]");if(vote)voteOnVibe(Number(vote.dataset.vibeVote));
 if(e.target.id==="vibe-close-viewer")$("vibe-viewer").hidden=true;
 if(e.target.id==="vibe-delete-story")deleteVibe();
});
$("vibe-viewer").addEventListener("submit",e=>{if(e.target.id==="vibe-reply-form")replyToVibe(e);});

$("profile-form").addEventListener("submit",saveMyProfile);
["profile-name","profile-username","profile-country","profile-bio","profile-avatar"].forEach(id => $(id).addEventListener("input",renderProfilePreview));
$("dating-setup-form").addEventListener("submit",saveDatingProfile);
$("dating-refresh").addEventListener("click",loadDating);
$("dating-people").addEventListener("click",e=>{const b=e.target.closest("[data-dating-like]");if(b){b.disabled=true;sendDatingLike(b.dataset.datingLike);}});
$("add-by-id-form").addEventListener("submit",sendFriendRequestByUsername);
$("copy-veter-id").addEventListener("click",copyVeterId);
$("share-profile").addEventListener("click",shareMyProfile);
$("create-group").addEventListener("click",createGroup);
$("group-list").addEventListener("click",e=>{const b=e.target.closest("[data-open-group]");if(b)openGroup(b.dataset.openGroup);});
$("group-message-form").addEventListener("submit",sendGroupMessage);
$("message-input").addEventListener("input",()=>{broadcastTyping(true);clearTimeout(typingStopTimer);typingStopTimer=setTimeout(()=>broadcastTyping(false),1100);});
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
    restorePostDraft();
    status("Welcome back, " + profile.display_name + "!");
    await Promise.all([loadPeople(),loadConversations(),loadFeed(),loadFriendRequests(),loadNotifications(),loadGroups(),startPresence()]);
    await openSharedProfileIfRequested();
  } catch(e) {
    showSignedOut();
    status("Google sign-in worked, but the database connection needs attention: " + friendly(e),true);
  }
});
window.addEventListener("beforeunload",() => {
  if (messageChannel && db) db.removeChannel(messageChannel);
});
