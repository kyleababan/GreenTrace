
import { initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";

import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC-TFWeqt40DODi6Xzu3SSQ3lDkRd5HSv8",
  authDomain: "greentrace-b84b5.firebaseapp.com",
  projectId: "greentrace-b84b5",
  storageBucket: "greentrace-b84b5.firebasestorage.app",
  messagingSenderId: "630473607261",
  appId: "1:630473607261:web:2d117c80c71f3cf9f625b4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export default app;