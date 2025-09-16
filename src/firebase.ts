// src/firebase.ts
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyB7hSy1d4EvZrOzgIJD-jMAl91byGceanE",
  authDomain: "eakc-c2ec1.firebaseapp.com",
  projectId: "eakc-c2ec1",
  storageBucket: "eakc-c2ec1.firebasestorage.app",
  messagingSenderId: "581223973902",
  appId: "1:581223973902:web:b8410c87b07f6c0952e85f",
  measurementId: "G-1F67RZ4M3Z"
};

const app = initializeApp(firebaseConfig);

export { app };
