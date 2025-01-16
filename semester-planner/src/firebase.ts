import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';


const firebaseConfig = {
  apiKey: "AIzaSyCCp3fqZ7tQUMCcZb5LM8zdNv88D3Dnb0M",
  authDomain: "oplenner-id.firebaseapp.com",
  projectId: "oplenner-id",
  storageBucket: "oplenner-id.firebasestorage.app",
  messagingSenderId: "600772103063",
  appId: "1:600772103063:web:bc28d7d3c8a2ae670652d2",
  measurementId: "G-Y0MVW1N7PY"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);