// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJyWV4yrfsNfmhTxAdzoX8xS8oxcu-gcE", 
  authDomain: "oplanner-d15b8.firebaseapp.com",
  projectId: "oplanner-d15b8",
  storageBucket: "oplanner-d15b8.firebasestorage.app",
  messagingSenderId: "997951072533",
  appId: "1:997951072533:web:29498bcbdd430d05c0a11c",
  measurementId: "G-1K9L9YL4HE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Optional: Initialize Analytics (if required)
export const analytics = getAnalytics(app);
