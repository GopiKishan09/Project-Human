import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ============================================================================
// FIREBASE CONFIGURATION
// Paste your Firebase Config below:
// ============================================================================
const resolveAuthDomain = () => {
  const hostname = window.location?.hostname || 'localhost';
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return 'localhost';
  }
  return hostname;
};

const firebaseConfig = {
  apiKey: "AIzaSyBh_NK7DsvbvR4xgoHaDqYUSOhk1vIndr8",
  authDomain: "project-human-c05be.firebaseapp.com",
  projectId: "project-human-c05be",
  storageBucket: "project-human-c05be.firebasestorage.app",
  messagingSenderId: "935466733995",
  appId: "1:935466733995:web:b57bc18f86f3f2698042ee",
  measurementId: "G-DK7ME2YG3T"
};
// ============================================================================

let app;
let auth;
let db;
let isFirebaseEnabled = false;

// Initialize Firebase if credentials are set (not starting with YOUR_)
if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_")) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Initialize Firestore with multi-tab offline persistence
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    
    isFirebaseEnabled = true;
    console.log("Firebase Modular SDK initialized successfully with offline persistence.");
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.warn("Firebase credentials not configured. Running in Local Fallback Mode.");
}

const googleProvider = new GoogleAuthProvider();

export {
  auth,
  db,
  isFirebaseEnabled,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch
};
