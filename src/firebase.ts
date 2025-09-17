// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// 🔧 Use the *project you want to deploy* (the one that has your Rules set).
// If you're using the new project, paste THAT config here.
const firebaseConfig = {
  apiKey: "AIzaSyBqBWkGbQ_Msi7Ldsjh6C2BH-xGr1k3FCE",
  authDomain: "read-rise-c1377.firebaseapp.com",
  projectId: "read-rise-c1377",
  storageBucket: "read-rise-c1377.firebasestorage.app",
  messagingSenderId: "2744962123",
  appId: "1:2744962123:web:a6aba360fa82cd9ae5d1ce",
  measurementId: "G-9VSPK48HZ3"
};

export const app = initializeApp(firebaseConfig);

// ✅ Firestore
export const db = getFirestore(app);

// ✅ Anonymous Auth (matches rules like `request.auth != null`)
export const auth = getAuth(app);
signInAnonymously(auth).catch((e) => {
  console.error("Anonymous sign-in failed:", e);
});

// (Optional: helpful for debugging)
onAuthStateChanged(auth, (u) => {
  if (u) console.log("Signed in anonymously as:", u.uid);
});
