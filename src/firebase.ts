// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBqBWkGbQ_Msi7Ldsjh6C2BH-xGr1k3FCE",
  authDomain: "read-rise-c1377.firebaseapp.com",
  projectId: "read-rise-c1377",
  storageBucket: "read-rise-c1377.appspot.com", // ✅ corrected bucket
  messagingSenderId: "2744962123",
  appId: "1:2744962123:web:a6aba360fa82cd9ae5d1ce",
  measurementId: "G-9VSPK48HZ3", // optional
};

// ✅ Initialize Firebase
export const app = initializeApp(firebaseConfig);

// ✅ Firestore
export const db = getFirestore(app);

// ✅ Auth (anonymous sign-in)
export const auth = getAuth(app);

// Try signing in anonymously right away
signInAnonymously(auth).catch((e) => {
  console.error("Anonymous sign-in failed:", e);
});

// Log auth state for debugging
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Signed in as:", user.uid, user.isAnonymous ? "(anon)" : "(regular)");
  } else {
    console.warn("No user signed in.");
  }
});
