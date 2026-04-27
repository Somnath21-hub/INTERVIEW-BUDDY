
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "interviewiq-1b4e8.firebaseapp.com",
  projectId: "interviewiq-1b4e8",
  storageBucket: "interviewiq-1b4e8.firebasestorage.app",
  messagingSenderId: "654493841411",
  appId: "1:654493841411:web:2b681674c6678a9c12f636"
};



const app = initializeApp(firebaseConfig);
const auth=getAuth(app)
const provider = new GoogleAuthProvider()
export{auth,provider}//to generate popup