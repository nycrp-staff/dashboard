import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMIlJcxs8CacAInk-oCJYERxLW4rd12oI",
  authDomain: "new-york-roleplay-staff-portal.firebaseapp.com",
  projectId: "new-york-roleplay-staff-portal",
  storageBucket: "new-york-roleplay-staff-portal.firebasestorage.app",
  messagingSenderId: "487380667709",
  appId: "1:487380667709:web:8636d123c5d0f2ef89c954"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
