import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // NEW

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA0hgDU75i7nENIWFodBeqvzvmZEOAVJqE",
  authDomain: "daily-log-james.firebaseapp.com",
  projectId: "daily-log-james",
  storageBucket: "daily-log-james.firebasestorage.app",
  messagingSenderId: "933698778128",
  appId: "1:933698778128:web:767ec2d6f21564fc84c695"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Initialize Storage
export const storage = getStorage(app); // NEW