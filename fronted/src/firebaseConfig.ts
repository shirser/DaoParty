// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDolXxRo7z5IbAcbuf58xkvtOzAmWqDHpU",
  authDomain: "daoparty-abf91.firebaseapp.com",
  projectId: "daoparty-abf91",
  storageBucket: "daoparty-abf91.firebasestorage.app",
  messagingSenderId: "574514570647",
  appId: "1:574514570647:web:49c36bd772d33a785250d2",
  measurementId: "G-92VXSLBM2H"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
// Инициализация Firestore (если нужно)
const db = getFirestore(app);
// Инициализация аналитики (если нужна)
const analytics = getAnalytics(app);

export { app, db, analytics };
