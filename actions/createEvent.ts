'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { generateCode, addHoursToNow } from '@/lib/utils';

export async function createEvent(files: string[], durationHours: number) {
  const code = generateCode();

  const eventRef = adminDb.collection('events').doc(code);
  const expiresAt = addHoursToNow(durationHours); // should return a JS Date

  await eventRef.set({
    urls: files,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: Timestamp.now(),
  });

  return { success: true, code };
}
