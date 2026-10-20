import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch {
  // Optional fallback
}

if (!getApps().length && firebaseConfig.projectId) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getApps().length ? getAuth() : null;
