import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "butts-cards.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "butts-cards",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "butts-cards.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abc123"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { db, collection, addDoc, query, orderBy, limit, getDocs };

export async function saveScore(playerName: string, score: number) {
  try {
    await addDoc(collection(db, "scores"), {
      playerName,
      score,
      timestamp: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error saving score:", error);
    return false;
  }
}

export async function getLeaderboard(limitCount = 10) {
  try {
    const q = query(
      collection(db, "scores"),
      orderBy("score", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    return [];
  }
}
