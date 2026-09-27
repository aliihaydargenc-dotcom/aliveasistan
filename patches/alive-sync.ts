import { Account, Client, ID, Query, Storage } from 'appwrite';
import * as Y from 'yjs';

const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = 'alive-asistan';
const APPWRITE_BUCKET_ID = 'voice-notes';
const ALLOWED_USER_ID = '6ab81ae30032650e2d34';
const SYNC_FOLDER = 'affine-sync';
const SYNC_FOLDER_VALUE = `${SYNC_FOLDER}/`;
const SYNC_INTERVAL_MS = 25_000;
const KEEP_VERSIONS = 3;

type SyncDoc = {
  id: string;
  update: string;
};

type SyncAsset = {
  id: string;
  type: string;
  data: string;
};

type AliveSyncBundle = {
  version: 1;
  savedAt: number;
  sourceWorkspaceId: string;
  fingerprint: string;
  root: string;
  docs: SyncDoc[];
  assets: SyncAsset[];
};

type AliveWorkspace = {
  id: string;
  docCollection: any;
  engine?: {
    doc?: {
      waitForDocReady?: (id: string) => Promise<unknown>;
    };
  };
};

declare global {
  interface Window {
    currentWorkspace?: AliveWorkspace;
  }
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);
const account = new Account(client);
const storage = new Storage(client);

let authenticated = false;
let currentWorkspace: AliveWorkspace | null = null;
let lastRemoteFileId = '';
let lastFingerprint = '';
let syncing = false;
let intervalId: number | undefined;

const statusEl = document.createElement('button');
statusEl.type = 'button';
statusEl.setAttribute('aria-label', 'Alive senkronizasyon durumu');
Object.assign(statusEl.style, {
  position: 'fixed',
  right: '12px',
  bottom: '12px',
  zIndex: '2147483000',
  border: '1px solid rgba(0,0,0,.10)',
  borderRadius: '999px',
  padding: '8px 11px',
  background: 'rgba(255,255,255,.92)',
  color: '#191919',
  boxShadow: '0 4px 18px rgba(0,0,0,.10)',
  backdropFilter: 'blur(14px)',
  font: '600 12px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  cursor: 'pointer',
});
statusEl.textContent = 'Alive • Hazırlanıyor';
statusEl.addEventListener('click', () => {
  void syncCycle(true);
});
document.body.append(statusEl);

function setStatus(label: string, error = false) {
  statusEl.textContent = `Alive • ${label}`;
  statusEl.style.color = error ? '#b42318' : '#191919';
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function encodeBundle(bundle: AliveSyncBundle): Promise<File> {
  const json = JSON.stringify(bundle);
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([json], { type: 'application/json' })
      .stream()
      .pipeThrough(new CompressionStream('gzip'));
    const compressed = await new Response(stream).blob();
    return new File(
      [compressed],
      `alive-sync-${bundle.savedAt}.json.gz`,
      { type: 'application/gzip' }
    );
  }
  return new File(
    [json],
    `alive-sync-${bundle.savedAt}.json`,
    { type: 'application/json' }
  );
}

async function decodeBundle(fileName: string, blob: Blob): Promise<AliveSyncBundle> {
  let text: string;
  if (fileName.endsWith('.gz')) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Bu tarayıcı sıkıştırılmış Alive yedeğini açamıyor.');
    }
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = await blob.text();
  }
  const bundle = JSON.parse(text) as AliveSyncBundle;
  if (bundle.version !== 1) {
    throw new Error(`Desteklenmeyen Alive sync sürümü: ${String(bundle.version)}`);
  }
  return bundle;
}

function showLogin(): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.id = 'alive-appwrite-login';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'grid',
      placeItems: 'center',
      padding: '20px',
      background: 'rgba(245,246,248,.96)',
      backdropFilter: 'blur(18px)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    });

    const form = document.createElement('form');
    Object.assign(form.style, {
      width: 'min(100%, 380px)',
      padding: '24px',
      borderRadius: '24px',
      background: '#fff',
      boxShadow: '0 18px 60px rgba(0,0,0,.13)',
      border: '1px solid rgba(0,0,0,.07)',
      display: 'grid',
      gap: '12px',
    });

    const title = document.createElement('div');
    title.textContent = 'Alive';
    Object.assign(title.style, {
      fontSize: '27px',
      fontWeight: '750',
      letterSpacing: '-.7px',
      marginBottom: '2px',
    });

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Kendi çalışma alanına giriş yap';
    Object.assign(subtitle.style, {
      fontSize: '14px',
      color: '#666',
      marginBottom: '8px',
    });

    const email = document.createElement('input');
    email.type = 'email';
    email.autocomplete = 'email';
    email.placeholder = 'E-posta';
    email.required = true;

    const password = document.createElement('input');
    password.type = 'password';
    password.autocomplete = 'current-password';
    password.placeholder = 'Şifre';
    password.required = true;

    for (const input of [email, password]) {
      Object.assign(input.style, {
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid #d9dce1',
        borderRadius: '12px',
        padding: '13px 14px',
        fontSize: '16px',
        outline: 'none',
        background: '#fff',
      });
    }

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Giriş yap';
    Object.assign(submit.style, {
      border: '0',
      borderRadius: '12px',
      padding: '13px 14px',
      fontSize: '15px',
      fontWeight: '700',
      background: '#171717',
      color: '#fff',
      cursor: 'pointer',
    });

    const error = document.createElement('div');
    Object.assign(error.style, {
      minHeight: '18px',
      fontSize: '13px',
      color: '#b42318',
    });

    form.append(title, subtitle, email, password, submit, error);
    overlay.append(form);
    document.body.append(overlay);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Giriş yapılıyor…';
      error.textContent = '';
      try {
        await account.createEmailPasswordSession({
          email: email.value.trim(),
          password: password.value,
        });
        const user = await account.get();
        if (user.$id !== ALLOWED_USER_ID) {
          await account.deleteSession({ sessionId: 'current' });
          throw new Error('Bu Alive kurulumu yalnızca sahibinin hesabına açıktır.');
        }
        authenticated = true;
        overlay.remove();
        setStatus('Bağlandı');
        resolve();
      } catch (err) {
        error.textContent =
          err instanceof Error ? err.message : 'Giriş yapılamadı.';
      } finally {
        submit.disabled = false;
        submit.textContent = 'Giriş yap';
      }
    });
  });
}

async function ensureAuth() {
  try {
    const user = await account.get();
    if (user.$id !== ALLOWED_USER_ID) {
      await account.deleteSession({ sessionId: 'current' });
      throw new Error('Farklı kullanıcı oturumu');
    }
    authenticated = true;
    setStatus('Bağlandı');
  } catch {
    setStatus('Giriş bekleniyor');
    await showLogin();
  }
}

async function listSyncFiles(): Promise<any[]> {
  const result = await storage.listFiles({
    bucketId: APPWRITE_BUCKET_ID,
    queries: [
      Query.equal('folder', [SYNC_FOLDER_VALUE]),
      Query.limit(20),
    ],
  });
  return [...result.files].sort(
    (a: any, b: any) =>
      new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
  );
}

async function fetchSyncFile(file: any): Promise<AliveSyncBundle> {
  const url = storage.getFileDownload({
    bucketId: APPWRITE_BUCKET_ID,
    fileId: file.$id,
  });
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Alive sync indirilemedi (${response.status}).`);
  }
  return decodeBundle(file.name, await response.blob());
}

async function captureCore(workspace: AliveWorkspace) {
  const collection = workspace.docCollection;
  collection.doc.getMap('meta').set('name', 'Alive');

  const root = bytesToBase64(Y.encodeStateAsUpdate(collection.doc));
  const docs: SyncDoc[] = [];

  for (const doc of collection.docs.values()) {
    try {
      doc.load();
      if (workspace.engine?.doc?.waitForDocReady) {
        await Promise.race([
          workspace.engine.doc.waitForDocReady(doc.id),
          new Promise(resolve => setTimeout(resolve, 800)),
        ]);
      }
      docs.push({
        id: doc.id,
        update: bytesToBase64(Y.encodeStateAsUpdate(doc.spaceDoc)),
      });
    } catch (err) {
      console.warn('[Alive Sync] Belge okunamadı', doc.id, err);
    }
  }

  docs.sort((a, b) => a.id.localeCompare(b.id));
  const assetIds = (await collection.blobSync.list()).sort();
  const fingerprint = await sha256(
    `${root}|${docs.map(doc => `${doc.id}:${doc.update}`).join('|')}|${assetIds.join('|')}`
  );

  return { root, docs, assetIds, fingerprint };
}

async function buildBundle(workspace: AliveWorkspace): Promise<AliveSyncBundle> {
  const core = await captureCore(workspace);
  const assets: SyncAsset[] = [];

  for (const id of core.assetIds) {
    const blob = await workspace.docCollection.blobSync.get(id);
    if (!blob) continue;
    assets.push({
      id,
      type: blob.type || 'application/octet-stream',
      data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
    });
  }

  return {
    version: 1,
    savedAt: Date.now(),
    sourceWorkspaceId: workspace.id,
    fingerprint: core.fingerprint,
    root: core.root,
    docs: core.docs,
    assets,
  };
}

async function applyBundle(workspace: AliveWorkspace, bundle: AliveSyncBundle) {
  const collection = workspace.docCollection;
  setStatus('İndiriliyor');

  for (const asset of bundle.assets) {
    const bytes = base64ToBytes(asset.data);
    await collection.blobSync.set(
      asset.id,
      new Blob([bytes], { type: asset.type })
    );
  }

  Y.applyUpdate(collection.doc, base64ToBytes(bundle.root));
  await new Promise(resolve => setTimeout(resolve, 50));

  const isFirstRestore =
    localStorage.getItem('alive-sync-initialized') !== '1';
  const remoteDocIds = new Set(bundle.docs.map(doc => doc.id));

  if (isFirstRestore) {
    for (const localDoc of Array.from(collection.docs.values()) as any[]) {
      if (!remoteDocIds.has(localDoc.id)) {
        try {
          collection.removeDoc(localDoc.id);
        } catch (err) {
          console.warn('[Alive Sync] Yerel başlangıç belgesi kaldırılamadı', err);
        }
      }
    }
  }

  for (const remoteDoc of bundle.docs) {
    let doc = collection.getDoc(remoteDoc.id);
    if (!doc) {
      doc = collection.createDoc(remoteDoc.id);
    }
    doc.load();
    Y.applyUpdate(doc.spaceDoc, base64ToBytes(remoteDoc.update));
  }

  collection.doc.getMap('meta').set('name', 'Alive');
  localStorage.setItem('alive-sync-initialized', '1');
}

async function pullLatest() {
  if (!authenticated || !currentWorkspace) return;
  const files = await listSyncFiles();
  const latest = files[0];
  if (!latest || latest.$id === lastRemoteFileId) return;

  const bundle = await fetchSyncFile(latest);
  await applyBundle(currentWorkspace, bundle);
  lastRemoteFileId = latest.$id;

  const localCore = await captureCore(currentWorkspace);
  if (localCore.fingerprint === bundle.fingerprint) {
    lastFingerprint = localCore.fingerprint;
  } else {
    lastFingerprint = '';
  }
}

async function saveIfChanged(force = false) {
  if (!authenticated || !currentWorkspace) return;

  const core = await captureCore(currentWorkspace);
  if (!force && core.fingerprint === lastFingerprint) {
    setStatus(navigator.onLine ? 'Senkronize' : 'Çevrimdışı');
    return;
  }

  setStatus('Kaydediliyor');
  const bundle = await buildBundle(currentWorkspace);
  if (!force && bundle.fingerprint === lastFingerprint) {
    setStatus('Senkronize');
    return;
  }

  const file = await encodeBundle(bundle);
  if (file.size > 49_000_000) {
    throw new Error(
      'Alive senkron paketi 49 MB sınırını aştı. Büyük ekleri ayrı dosyalara taşımalıyız.'
    );
  }

  const created = await storage.createFile({
    bucketId: APPWRITE_BUCKET_ID,
    fileId: ID.unique(),
    file,
    folder: SYNC_FOLDER,
  });

  lastRemoteFileId = created.$id;
  lastFingerprint = bundle.fingerprint;
  localStorage.setItem('alive-sync-initialized', '1');

  const files = await listSyncFiles();
  for (const oldFile of files.slice(KEEP_VERSIONS)) {
    try {
      await storage.deleteFile({
        bucketId: APPWRITE_BUCKET_ID,
        fileId: oldFile.$id,
      });
    } catch (err) {
      console.warn('[Alive Sync] Eski sürüm silinemedi', err);
    }
  }

  setStatus('Senkronize');
}

async function syncCycle(forceSave = false) {
  if (syncing || !authenticated || !currentWorkspace) return;
  syncing = true;
  try {
    if (!navigator.onLine) {
      setStatus('Çevrimdışı');
      return;
    }
    await pullLatest();
    await saveIfChanged(forceSave);
  } catch (err) {
    console.error('[Alive Sync]', err);
    setStatus('Senkron hatası', true);
  } finally {
    syncing = false;
  }
}

function bindWorkspace(workspace: AliveWorkspace) {
  if (!workspace || currentWorkspace?.id === workspace.id) return;
  currentWorkspace = workspace;
  lastFingerprint = '';
  lastRemoteFileId = '';

  if (intervalId) {
    window.clearInterval(intervalId);
  }
  intervalId = window.setInterval(() => {
    void syncCycle();
  }, SYNC_INTERVAL_MS);

  void syncCycle();
}

window.addEventListener('affine:workspace:change', () => {
  if (window.currentWorkspace) {
    bindWorkspace(window.currentWorkspace);
  }
});

window.addEventListener('focus', () => {
  void syncCycle();
});

window.addEventListener('online', () => {
  setStatus('Bağlandı');
  void syncCycle();
});

window.addEventListener('offline', () => {
  setStatus('Çevrimdışı');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void syncCycle();
  } else {
    void saveIfChanged();
  }
});

void ensureAuth().then(() => {
  if (window.currentWorkspace) {
    bindWorkspace(window.currentWorkspace);
  }
});
