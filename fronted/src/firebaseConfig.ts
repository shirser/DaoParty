import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDolXxRo7z5IbAcbuf58xkvtOzAmWqDHpU",
  authDomain: "daoparty-abf91.firebaseapp.com",
  projectId: "daoparty-abf91",
  storageBucket: "daoparty-abf91.appspot.com",
  messagingSenderId: "574514570647",
  appId: "1:574514570647:web:49c36bd772d33a785250d2",
  measurementId: "G-92VXSLBM2H"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

export { firestore };
