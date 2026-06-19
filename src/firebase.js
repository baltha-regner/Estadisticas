import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// 1. Sumamos la importación de Autenticación
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCif0_4qZATNzPgE20szvXLkej50PTAJE0",
  authDomain: "estadisticas1-1a51d.firebaseapp.com",
  projectId: "estadisticas1-1a51d",
  storageBucket: "estadisticas1-1a51d.firebasestorage.app",
  messagingSenderId: "1021708997660",
  appId: "1:1021708997660:web:a0655767cdae7f5c91bbd9"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Exportamos los servicios que vamos a usar
export const db = getFirestore(app);
// 2. Exportamos el módulo de autenticación configurado
export const auth = getAuth(app);