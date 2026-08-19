import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const app = initializeApp({
  projectId: "ai-studio-applet-webapp-d8b8b",
  apiKey: "AIzaSyCwz2rJuoFJTs5MaWz8Mt_lejyzThC2D_A",
});
const db = getFirestore(app, "ai-studio-d300d625-58ae-4ec1-853a-8c66bbf46c83");

async function run() {
  const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"), limit(5));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`Res ${doc.id}: createdAt=${data.createdAt}, confirmationEmail=${JSON.stringify(data.confirmationEmail)}`);
  });
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
