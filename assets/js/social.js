import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
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
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxdmZwaGVmdXN2YnZldWNxYnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNzA0MTYsImV4cCI6MjEwOTY0NjQxNn0.1C8kEAnmc7vLpF1bGiSsVVkm8egVsaPqsW7mGfApPJA";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Firebase remains the identity provider. Supabase receives the current
// Firebase ID token and stores application data in PostgreSQL.
const el = id => document.getElementById(id);
const status = el("auth-status");
const show = message => {
  if (status) status.textContent = message;
};

show("Veter Social sign-in is ready. Choose Google or enter your phone number.");
window.addEventListener("error", event => {
  console.error("Veter Social script error:", event.error || event.message);
  show("A page script error occurred. Refresh the page; if it continues, send support the browser console error.");
});
window.addEventListener("unhandledrejection", event => {
  console.error("Veter Social startup error:", event.reason);
  show("A connection module failed to load. Please refresh and try again.");
});

let confirmationResult = null;
let recaptchaVerifier = null;
let lastProfileSyncUid = null;

function friendly(error) {
  if (error?.code === "auth/operation-not-allowed") {
    return "Enable this sign-in method in Firebase Authentication → Sign-in method.";
  }
  if (error?.code === "auth/unauthorized-domain") {
    return "Add theveter.in in Firebase Authentication → Settings → Authorized domains.";
  }
  if (error?.code === "auth/popup-blocked") {
    return "Allow sign-in popups in your browser and try again.";
  }
  if (error?.code === "auth/invalid-phone-number") {
    return "Enter a valid phone number with country code, e.g. +919876543210.";
  }
  if (error?.code === "auth/too-many-requests") {
    return "Firebase temporarily limited requests. Wait a while and try again.";
  }
  if (error?.code === "42501" || error?.code === "PGRST301" || error?.status === 401) {
    return "Database access is not ready. Check the Firebase integration in Veter Social's Supabase Authentication settings.";
  }
  return error?.message || "Something went wrong. Please try again.";
}

async function getSupabaseClient() {
  // Load the database SDK only after Firebase login succeeds. If the
  // database CDN is unavailable, the Google sign-in button still works.
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.119.0");
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => {
      const user = auth.currentUser;
      return user ? await user.getIdToken() : null;
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

async function syncProfile(user) {
  show("Signed in. Connecting to Veter Social database…");
  const supabase = await getSupabaseClient();
  const profile = {
    uid: user.uid,
    display_name: (user.displayName || "Veter member").trim().slice(0, 40) || "Veter member",
    avatar_url: user.photoURL || null,
    country: "",
    languages: [],
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("user_profiles")
    .upsert(profile, { onConflict: "uid" });

  if (error) {
    console.error("Veter Social profile sync failed:", error);
    show("Signed in, but profile storage is not connected yet. " + friendly(error));
    return false;
  }

  lastProfileSyncUid = user.uid;
  show("You're signed in to Veter Social. Your profile is saved.");
  return true;
}

el("google-sign-in")?.addEventListener("click", async () => {
  try {
    const button = el("google-sign-in");
    if (button) button.disabled = true;
    show("Opening Google sign-in…");
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error("Google sign-in failed:", error);
    show(friendly(error));
  } finally {
    const button = el("google-sign-in");
    if (button) button.disabled = false;
  }
});

el("send-otp")?.addEventListener("click", async () => {
  try {
    const phone = el("phone-number")?.value.trim();
    if (!phone) {
      show("Enter your phone number with country code first.");
      return;
    }

    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {});
    }

    confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
    el("phone-otp").hidden = false;
    el("verify-otp").hidden = false;
    show("OTP sent. Enter the code received on your phone.");
  } catch (error) {
    show(friendly(error));
    if (recaptchaVerifier) {
      try {
        await recaptchaVerifier.clear();
      } catch {
        // Ignore cleanup errors; the original sign-in error is more useful.
      }
      recaptchaVerifier = null;
    }
  }
});

el("verify-otp")?.addEventListener("click", async () => {
  try {
    if (!confirmationResult) {
      show("Request an OTP first.");
      return;
    }
    await confirmationResult.confirm(el("phone-otp")?.value.trim() || "");
  } catch (error) {
    show(friendly(error));
  }
});

el("sign-out")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    lastProfileSyncUid = null;
    show("You have signed out.");
  } catch (error) {
    show(friendly(error));
  }
});

onAuthStateChanged(auth, user => {
  for (const id of ["google-sign-in", "phone-number", "send-otp"]) {
    if (el(id)) el(id).hidden = !!user;
  }

  if (user) {
    if (el("phone-otp")) el("phone-otp").hidden = true;
    if (el("verify-otp")) el("verify-otp").hidden = true;
    show("Signed in as " + (user.displayName || user.email || user.phoneNumber || "Veter member") + ". Saving profile…");

    if (lastProfileSyncUid !== user.uid) {
      syncProfile(user).catch(error => {
        console.error("Unexpected profile sync error:", error);
        show(friendly(error));
      });
    }
  } else {
    lastProfileSyncUid = null;
    show("Sign in to join Veter Social.");
  }

  if (el("sign-out")) el("sign-out").hidden = !user;
});
