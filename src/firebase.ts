// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBqBWkGbQ_Msi7Ldsjh6C2BH-xGr1k3FCE",
  authDomain: "read-rise-c1377.firebaseapp.com",
  projectId: "read-rise-c1377",
  storageBucket: "read-rise-c1377.appspot.com", // ✅ bucket name form
  messagingSenderId: "2744962123",
  appId: "1:2744962123:web:a6aba360fa82cd9ae5d1ce",
  measurementId: "G-9VSPK48HZ3", // optional
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ❌ No signInAnonymously or onAuthStateChanged here.
// App.tsx already handles anonymous sign-in and gating UI on auth.
