// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore"; // CHANGED THIS LINE

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSy...", // KEEP YOUR REAL KEY HERE
  authDomain: "daily-log-james.firebaseapp.com",
  projectId: "daily-log-james",
  storageBucket: "daily-log-james.firebasestorage.app",
  messagingSenderId: "933698778128",
  appId: "1:933698778128:web:767ec2d6f21564fc84c695"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with FORCE LONG POLLING
// This is the magic setting that fixes the "Saving..." freeze
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});