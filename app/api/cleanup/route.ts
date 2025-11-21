// app/api/cleanup/route.ts
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

export async function GET() {
  try {
    const now = new Date().toISOString();
    const q = query(
      collection(db, 'events'),
      where('expiresAt', '<', now)
    );

    const snapshot = await getDocs(q);
    const deletions = snapshot.docs.map((d) => deleteDoc(doc(db, 'events', d.id)));

    await Promise.all(deletions);

    return Response.json({ deleted: deletions.length });
  } catch (error) {
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}