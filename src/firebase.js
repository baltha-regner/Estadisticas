// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Estos datos te los da Firebase al crear el proyecto
const firebaseConfig = {
  apiKey: 'AIzaSyCif0_4qZATNzPgE20szvXLkej50PTAJE0',
  authDomain: 'estadisticas1-1a51d.firebaseapp.com',
  projectId: 'estadisticas1-1a51d',
  storageBucket: 'estadisticas1-1a51d.firebasestorage.app',
  messagingSenderId: '1021708997660',
  appId: '1:1021708997660:web:a0655767cdae7f5c91bbd9',
  measurementId: 'G-44TPWPBFSX',
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
// Inicializar la Base de Datos (Firestore)
export const db = getFirestore(app);
