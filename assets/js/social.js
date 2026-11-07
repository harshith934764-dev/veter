import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyB6ky_ETioOqiONq9T4uousDRpOzOMRRn0",
  authDomain: "veter-social.firebaseapp.com",
  projectId: "veter-social",
  storageBucket: "veter-social.firebasestorage.app",
  messagingSenderId: "504664421504",
  appId: "1:504664421504:web:a1f681566757c31b69a265",
  measurementId: "G-D19HJNGF9S"
};
const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const el=id=>document.getElementById(id), status=el("auth-status");
const show=message=>{if(status)status.textContent=message;};
let confirmationResult=null, recaptchaVerifier=null;
function friendly(error){
 const map={"auth/operation-not-allowed":"Enable this provider in Firebase Authentication → Sign-in method.","auth/unauthorized-domain":"Add theveter.in in Firebase Authentication → Settings → Authorized domains.","auth/popup-blocked":"Allow sign-in popups in your browser and try again.","auth/invalid-phone-number":"Enter a valid phone number with country code, e.g. +919876543210.","auth/too-many-requests":"Firebase temporarily limited requests. Wait a while and try again."};
 return map[error.code]||error.message||"Sign-in failed. Please try again.";
}
async function saveProfile(user){
 const ref=doc(db,"users",user.uid), old=await getDoc(ref);
 const data={displayName:(user.displayName||"Veter member").slice(0,40),photoURL:user.photoURL||null,country:"",languages:[]};
 if(!old.exists())data.createdAt=serverTimestamp();
 await setDoc(ref,data,{merge:true});
}
el("google-sign-in")?.addEventListener("click",async()=>{
 try{show("Opening Google sign-in…");const result=await signInWithPopup(auth,new GoogleAuthProvider());await saveProfile(result.user);show("You're signed in to Veter Social!");}
 catch(error){show(friendly(error));}
});
el("send-otp")?.addEventListener("click",async()=>{
 try{
  const phone=el("phone-number").value.trim();if(!phone)return show("Enter your phone number with country code first.");
  if(!recaptchaVerifier)recaptchaVerifier=new RecaptchaVerifier(auth,"recaptcha-container",{});
  confirmationResult=await signInWithPhoneNumber(auth,phone,recaptchaVerifier);
  el("phone-otp").hidden=false;el("verify-otp").hidden=false;show("OTP sent. Enter the code received on your phone.");
 }catch(error){show(friendly(error));if(recaptchaVerifier){try{await recaptchaVerifier.clear();}catch{}recaptchaVerifier=null;}}
});
el("verify-otp")?.addEventListener("click",async()=>{
 try{if(!confirmationResult)return show("Request an OTP first.");const result=await confirmationResult.confirm(el("phone-otp").value.trim());await saveProfile(result.user);show("Phone verified. You're signed in!");}
 catch(error){show(friendly(error));}
});
el("sign-out")?.addEventListener("click",async()=>{await signOut(auth);show("You have signed out.");});
onAuthStateChanged(auth,user=>{
 for(const id of ["google-sign-in","phone-number","send-otp"])if(el(id))el(id).hidden=!!user;
 if(user){el("phone-otp").hidden=true;el("verify-otp").hidden=true;}
 if(el("sign-out"))el("sign-out").hidden=!user;
 if(user)show("Signed in as "+(user.displayName||user.email||user.phoneNumber||"Veter member")+".");
});
