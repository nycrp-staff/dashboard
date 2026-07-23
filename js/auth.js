// auth.js
// Handles the login form on index.html, and (via guardPortal) protects
// portal.html by redirecting signed-out visitors back to the login page.

import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Login page (index.html) ----------

const loginForm = document.getElementById('login-form');

if (loginForm) {
  // Already signed in? Skip straight to the portal.
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = 'portal.html';
  });

  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      await signInWithEmailAndPassword(auth, username, password);
      window.location.href = 'portal.html';
    } catch (err) {
      errorBox.textContent = 'Login failed. Check your credentials and try again.';
      errorBox.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
}

// ---------- Portal page guard (used by portal.js) ----------

// Redirects to index.html if signed out; otherwise loads the matching
// /staff/{uid} Firestore doc and calls onReady(user, profile).
export function guardPortal(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    let profile = null;
    try {
      const snap = await getDoc(doc(db, 'staff', user.uid));
      profile = snap.exists() ? snap.data() : null;
    } catch (err) {
      console.error('Failed to load staff profile', err);
    }
    onReady(user, profile);
  });
}

export function logout() {
  return signOut(auth);
}
