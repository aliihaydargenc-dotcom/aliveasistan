import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileAudio,
  FileText,
  Home,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mic,
  MoreHorizontal,
  NotebookPen,
  Pause,
  Palette,
  Pin,
  Plus,
  QrCode,
  Search,
  Shapes,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { ID, Permission, Query, Role } from "appwrite";
import { QRCodeSVG } from "qrcode.react";
import { jsPDF } from "jspdf";
import { account, config, storage, tablesDB } from "./appwrite";
import type { AppUser, CalendarEvent, Note, ViewId } from "./types";

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: "home", label: "Ana", icon: Home },
  { id: "notes", label: "Notlar", icon: NotebookPen },
  { id: "voice", label: "Ses", icon: Mic },
  { id: "calendar", label: "Takvim", icon: CalendarDays },
  { id: "tools", label: "Araçlar", icon: Wrench },
];

type ThemeId = "violet" | "sunset" | "ocean" | "forest";

const themeOptions: Array<{ id: ThemeId; label: string }> = [
  { id: "violet", label: "Violet" },
  { id: "sunset", label: "Sunset" },
  { id: "ocean", label: "Ocean" },
  { id: "forest", label: "Forest" },
];

function ownerPermissions(userId: string) {
  const role = Role.user(userId);
  return [Permission.read(role), Permission.update(role), Permission.delete(role)];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function isoToLocalInput(value?: string) {
  const d = value ? new Date(value) : new Date();
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  return new Date(value).toISOString();
}

function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<ViewId>("home");
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<ThemeId>(() => (localStorage.getItem("alive-theme") as ThemeId) || "violet");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("alive-theme", theme);
  }, [theme]);

  useEffect(() => {
    account
      .get()
      .then((u) => setUser(u as AppUser))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setError("");
    try {
      const [n, e] = await Promise.all([
        tablesDB.listRows({ databaseId: config.databaseId, tableId: config.notesTableId, queries: [Query.orderDesc("$updatedAt"), Query.limit(100)] }),
        tablesDB.listRows({ databaseId: config.databaseId, tableId: config.eventsTableId, queries: [Query.orderAsc("startAt"), Query.limit(200)] }),
      ]);
      setNotes(n.rows as unknown as Note[]);
      setEvents(e.rows as unknown as CalendarEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veriler alınamadı.");
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (checkingSession) return <CenteredLoader label="Oturum hazırlanıyor" />;
  if (!user) return <Login onLogin={(u) => setUser(u)} />;

  const logout = async () => {
    await account.deleteSession({ sessionId: "current" }).catch(() => undefined);
    setUser(null);
    setNotes([]);
    setEvents([]);
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <aside className="sidebar glass">
        <Brand compact={false} />
        <nav className="side-nav">
          {navItems.map((item) => (
            <NavButton key={item.id} active={view === item.id} onClick={() => setView(item.id)} icon={<item.icon size={19} />} label={item.label} />
          ))}
        </nav>
        <PersonalSpaceCard theme={theme} onThemeChange={setTheme} />
        <div className="sidebar-footer">
          <div className="avatar">{(user.name || user.$id || user.email || "A").slice(0, 1).toLocaleUpperCase("tr-TR")}</div>
          <div className="user-copy"><strong>{user.name || user.$id || "Kişisel alan"}</strong><span>{user.email || "Güvenli oturum"}</span></div>
          <button className="icon-button" onClick={logout} aria-label="Çıkış"><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="main-stage">
        <header className="mobile-header glass"><Brand compact /><div className="mobile-header-actions"><ThemePicker theme={theme} onChange={setTheme} compact /><button className="icon-button" onClick={logout} aria-label="Çıkış"><LogOut size={18} /></button></div></header>
        {error && <div className="notice error-notice"><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}
        {loadingData && <div className="sync-pill"><LoaderCircle className="spin" size={14} /> Eşitleniyor</div>}

        <div className="view-wrap" key={view}>
          {view === "home" && <HomeView user={user} notes={notes} events={events} onView={setView} onRefresh={refresh} />}
          {view === "notes" && <NotesView user={user} notes={notes} onRefresh={refresh} />}
          {view === "voice" && <VoiceView user={user} onSaved={async () => { await refresh(); setView("notes"); }} />}
          {view === "calendar" && <CalendarView user={user} events={events} onRefresh={refresh} />}
          {view === "tools" && <ToolsView />}
        </div>
      </main>

      <nav className="bottom-nav glass">
        {navItems.map((item) => <NavButton key={item.id} compact active={view === item.id} onClick={() => setView(item.id)} icon={<item.icon size={20} />} label={item.label} />)}
      </nav>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await account.createEmailPasswordSession({ email: email.trim(), password });
      const current = await account.get();
      onLogin(current as AppUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı.");
    } finally { setBusy(false); }
  };

  return (
    <div className="login-page">
      <div className="ambient ambient-a" /><div className="ambient ambient-b" />
      <div className="login-shell">
        <section className="login-showcase">
          <div className="login-showcase-orb"><Sparkles size={30} /></div>
          <p className="eyebrow">Sadece sana ait</p>
          <h1>Düşüncelerinin<br />yaşadığı yer.</h1>
          <p>Not, ses, takvim ve küçük araçlar. Tek ekranda değil; tek bir kişisel atmosferde.</p>
          <div className="login-preview-stack" aria-hidden="true">
            <div className="preview-card preview-card-a"><StickyNote size={17} /><span>Bir fikri yakala</span></div>
            <div className="preview-card preview-card-b"><Mic size={17} /><span>Sesle kaydet</span></div>
            <div className="preview-card preview-card-c"><CalendarDays size={17} /><span>Gününe bırak</span></div>
          </div>
        </section>
        <section className="login-card glass">
          <div className="login-card-top"><div className="login-mark"><Sparkles size={23} /></div><div><strong>Alive</strong><span>Kişisel alan</span></div></div>
          <div><h2>Tekrar hoş geldin.</h2><p className="muted">Alanına devam etmek için giriş yap.</p></div>
          <form onSubmit={submit} className="login-form">
            <label>E-posta<input autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Parola<input autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button login-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}{busy ? "Giriş yapılıyor" : "Alanıma gir"}<ArrowUpRight size={17} /></button>
          </form>
        </section>
      </div>
    </div>
  );
}

function HomeView({ user, notes, events, onView, onRefresh }: { user: AppUser; notes: Note[]; events: CalendarEvent[]; onView: (v: ViewId) => void; onRefresh: () => Promise<void> }) {
  const upcoming = events.filter((e) => new Date(e.startAt) >= new Date()).slice(0, 3);
  const pinned = notes.filter((n) => n.pinned).slice(0, 3);
  const recent = notes.slice(0, 4);
  const today = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const firstName = (user.name || user.$id || "sen").split(" ")[0];
  return (
    <div className="home-view">
      <section className="home-hero">
        <div className="hero-orb hero-orb-a" /><div className="hero-orb hero-orb-b" />
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">{today}</p>
          <h1>Merhaba {firstName}.<br /><span>Burası senin alanın.</span></h1>
          <p className="hero-description">Aklına geleni bırak. Sonra düzenlersin.</p>
          <div className="hero-stats">
            <span><strong>{notes.length}</strong> not</span>
            <span><strong>{pinned.length}</strong> sabit</span>
            <span><strong>{upcoming.length}</strong> yaklaşan</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-glass-card hero-note"><StickyNote /><span>Fikirler</span><b>{notes.length}</b></div>
          <div className="hero-glass-card hero-calendar"><CalendarDays /><span>Sıradaki</span><b>{upcoming[0] ? new Date(upcoming[0].startAt).getDate() : "—"}</b></div>
          <div className="hero-spark"><Sparkles /></div>
        </div>
      </section>
      <section className="quick-grid">
        <QuickAction icon={<NotebookPen />} title="Yaz" text="Yeni bir not aç." onClick={() => onView("notes")} />
        <QuickAction accent icon={<Mic />} title="Konuş" text="Sesle yakala." onClick={() => onView("voice")} />
        <QuickAction icon={<CalendarDays />} title="Planla" text="Takvime bırak." onClick={() => onView("calendar")} />
        <QuickAction icon={<Shapes />} title="Üret" text="Araç merkezini aç." onClick={() => onView("tools")} />
      </section>
      <section className="home-section-head"><div><p className="eyebrow">Şimdi</p><h2>Günün akışı</h2></div><button className="refresh-icon-button" onClick={() => void onRefresh()} aria-label="Verileri yenile"><Clock3 size={17} /></button></section>
      <section className="two-col home-flow-grid">
        <Panel title="Sabitlerin" action={<button className="text-button" onClick={() => onView("notes")}>Tümü <ArrowUpRight size={13} /></button>}>
          {pinned.length ? pinned.map((n) => <MiniRow key={n.$id} icon={<Pin size={15} />} title={n.title} meta={formatDate(n.$updatedAt)} />) : <EmptyMini text="Henüz sabitlenmiş not yok." />}
        </Panel>
        <Panel title="Yaklaşanlar" action={<button className="text-button" onClick={() => onView("calendar")}>Takvim <ArrowUpRight size={13} /></button>}>
          {upcoming.length ? upcoming.map((e) => <MiniRow key={e.$id} icon={<CalendarDays size={15} />} title={e.title} meta={formatDate(e.startAt)} />) : <EmptyMini text="Yaklaşan takvim kaydı yok." />}
        </Panel>
      </section>
      <section className="home-section-head recent-head"><div><p className="eyebrow">Hatırla</p><h2>Son bıraktıkların</h2></div><button className="text-button" onClick={() => onView("notes")}>Notlara git <ArrowUpRight size={13} /></button></section>
      <section className="recent-note-grid">
        {recent.length ? recent.map((n, index) => <button className={`recent-note-card tone-${index + 1}`} key={n.$id} onClick={() => onView("notes")}><div className="recent-note-top"><span>{n.pinned ? <Pin size={14} /> : <StickyNote size={14} />}</span><time>{formatDate(n.$updatedAt)}</time></div><strong>{n.title || "İsimsiz not"}</strong><p>{(n.plainText || n.body || "Boş not").slice(0, 120)}</p><ArrowUpRight className="recent-note-arrow" size={17} /></button>) : <div className="recent-empty glass-card"><Sparkles /><span>İlk notunu bıraktığında burada görünür.</span></div>}
      </section>
    </div>
  );
}

function NotesView({ user, notes, onRefresh }: { user: AppUser; notes: Note[]; onRefresh: () => Promise<void> }) {
  const initialNote = notes[0] || null;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialNote?.$id || null);
  const [draft, setDraft] = useState({ title: initialNote?.title || "", body: initialNote?.body || "", pinned: !!initialNote?.pinned });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(initialNote?.$updatedAt || null);
  const [saveError, setSaveError] = useState("");
  const [mobileEditor, setMobileEditor] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "pinned">("all");
  const savedIdsRef = useRef(new Set(notes.map((n) => n.$id)));
  const lastSavedRef = useRef(new Map(notes.map((n) => [n.$id, JSON.stringify({ title: n.title || "", body: n.body || "", pinned: !!n.pinned })])));
  const queuedSaveRef = useRef(new Map<string, string>());
  const saveQueueRef = useRef(Promise.resolve());
  const pendingSavesRef = useRef(0);
  const selectedIdRef = useRef<string | null>(initialNote?.$id || null);

  useEffect(() => {
    notes.forEach((n) => savedIdsRef.current.add(n.$id));
  }, [notes]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const filtered = notes.filter((n) => (filterMode === "all" || n.pinned) && `${n.title} ${n.plainText || n.body || ""}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  const selected = selectedId ? notes.find((n) => n.$id === selectedId) || null : null;

  const newNote = () => {
    const id = ID.unique();
    setSelectedId(id);
    setDraft({ title: "", body: "", pinned: false });
    setSavedAt(null);
    setSaveError("");
    lastSavedRef.current.delete(id);
    setMobileEditor(true);
  };

  const choose = (n: Note) => {
    setSelectedId(n.$id);
    setDraft({ title: n.title || "", body: n.body || "", pinned: !!n.pinned });
    setSavedAt(n.$updatedAt);
    setSaveError("");
    lastSavedRef.current.set(n.$id, JSON.stringify({ title: n.title || "", body: n.body || "", pinned: !!n.pinned }));
    setMobileEditor(true);
  };

  const enqueueSave = useCallback((rowId: string, snapshot: typeof draft) => {
    const key = JSON.stringify(snapshot);
    if (lastSavedRef.current.get(rowId) === key || queuedSaveRef.current.get(rowId) === key) return;
    if (!savedIdsRef.current.has(rowId) && !snapshot.title.trim() && !snapshot.body.trim() && !snapshot.pinned) return;

    queuedSaveRef.current.set(rowId, key);
    pendingSavesRef.current += 1;
    setSaving(true);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        const data = {
          title: snapshot.title.trim() || "İsimsiz not",
          body: snapshot.body,
          plainText: snapshot.body.replace(/<[^>]+>/g, " ").trim(),
          kind: "note",
          pinned: snapshot.pinned,
          archived: false,
        };
        const row = savedIdsRef.current.has(rowId)
          ? await tablesDB.updateRow({ databaseId: config.databaseId, tableId: config.notesTableId, rowId, data })
          : await tablesDB.createRow({ databaseId: config.databaseId, tableId: config.notesTableId, rowId, data, permissions: ownerPermissions(user.$id) });
        savedIdsRef.current.add(rowId);
        lastSavedRef.current.set(rowId, key);
        if (selectedIdRef.current === rowId) {
          setSavedAt((row as unknown as Note).$updatedAt || new Date().toISOString());
          setSaveError("");
        }
        await onRefresh();
      } catch (e) {
        if (selectedIdRef.current === rowId) setSaveError(e instanceof Error ? e.message : "Not kaydedilemedi.");
      } finally {
        if (queuedSaveRef.current.get(rowId) === key) queuedSaveRef.current.delete(rowId);
        pendingSavesRef.current -= 1;
        if (pendingSavesRef.current === 0) setSaving(false);
      }
    });
  }, [onRefresh, user.$id]);

  useEffect(() => {
    if (!selectedId) return;
    const key = JSON.stringify(draft);
    if (lastSavedRef.current.get(selectedId) === key) return;
    if (!savedIdsRef.current.has(selectedId) && !draft.title.trim() && !draft.body.trim() && !draft.pinned) return;

    const snapshot = { ...draft };
    const rowId = selectedId;
    const timer = window.setTimeout(() => {
      enqueueSave(rowId, snapshot);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [draft, selectedId, enqueueSave]);

  const remove = async () => {
    if (!selectedId || !savedIdsRef.current.has(selectedId)) return;
    await tablesDB.deleteRow({ databaseId: config.databaseId, tableId: config.notesTableId, rowId: selectedId });
    savedIdsRef.current.delete(selectedId);
    lastSavedRef.current.delete(selectedId);
    setSelectedId(null);
    setDraft({ title: "", body: "", pinned: false });
    setSavedAt(null);
    setSaveError("");
    await onRefresh();
    setMobileEditor(false);
  };

  return (
    <>
      <PageHeader eyebrow="Notlar" title="Aklında kalmasın." description={`${notes.length} not · ${notes.filter((n) => n.pinned).length} sabit`} action={<button className="primary-button compact-btn" onClick={newNote}><Plus size={17} /> Yeni not</button>} />
      <div className={`notes-workspace ${mobileEditor ? "editor-open" : ""}`}>
        <section className="notes-list glass-card">
          <div className="search-box"><Search size={17} /><input placeholder="Notlarda ara" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="note-filter-row"><button className={filterMode === "all" ? "active" : ""} onClick={() => setFilterMode("all")}>Tümü <span>{notes.length}</span></button><button className={filterMode === "pinned" ? "active" : ""} onClick={() => setFilterMode("pinned")}><Pin size={13} /> Sabit <span>{notes.filter((n) => n.pinned).length}</span></button></div>
          <div className="note-cards">
            {filtered.map((n) => <button key={n.$id} className={`note-card ${selectedId === n.$id ? "active" : ""}`} onClick={() => choose(n)}><div className="note-card-title"><strong>{n.title}</strong>{n.pinned && <Pin size={14} />}</div><p>{(n.plainText || n.body || "Boş not").slice(0, 100)}</p><div className="note-card-meta"><span>{n.kind === "voice" ? <><Mic size={11} /> Sesli</> : <><StickyNote size={11} /> Not</>}</span><time>{formatDate(n.$updatedAt)}</time></div></button>)}
            {!filtered.length && <EmptyMini text="Bu aramada not bulunamadı." />}
          </div>
        </section>
        <section className="editor-pane glass-card">
          <div className="editor-toolbar">
            <button className="mobile-back" onClick={() => setMobileEditor(false)}><ChevronLeft size={18} /> Notlar</button>
            <button className={`tool-button ${draft.pinned ? "active" : ""}`} onClick={() => setDraft((d) => ({ ...d, pinned: !d.pinned }))}><Pin size={16} /> Sabitle</button>
            <div className="spacer" />
            <span className={`autosave-status ${saveError ? "error" : ""}`} title={saveError || undefined}>{saveError ? "Kayıt başarısız" : saving ? <><LoaderCircle className="spin" size={14} /> Kaydediliyor</> : savedAt ? <><Check size={14} /> Kaydedildi</> : "Otomatik kayıt"}</span>
            {(selected || savedIdsRef.current.has(selectedId || "")) && <button className="icon-button danger" onClick={() => void remove()} aria-label="Notu sil"><Trash2 size={17} /></button>}
          </div>
          <input className="note-title-input" placeholder="Not başlığı" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} onBlur={() => selectedId && enqueueSave(selectedId, { ...draft })} />
          <textarea className="note-body-input" placeholder="Buraya yazmaya başla…" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} onBlur={() => selectedId && enqueueSave(selectedId, { ...draft })} />
          <div className="editor-foot"><span>{draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0} kelime</span><span>{savedAt ? `Son kayıt ${formatDate(savedAt)}` : "Yeni not"}</span></div>
        </section>
      </div>
    </>
  );
}

function VoiceView({ user, onSaved }: { user: AppUser; onSaved: () => Promise<void> }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const recordingRef = useRef(false);
  const speechBlockedRef = useRef(false);
  const committedTranscriptRef = useRef("");

  useEffect(() => () => { recordingRef.current = false; if (timerRef.current) window.clearInterval(timerRef.current); recognitionRef.current?.stop?.(); recorderRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    setMessage(""); setBlob(null); setElapsed(0); setTranscript(""); chunksRef.current = [];
    speechBlockedRef.current = false;
    committedTranscriptRef.current = "";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => { setBlob(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })); stream.getTracks().forEach((t) => t.stop()); };
      recorder.start(500); recordingRef.current = true; setRecording(true);
      timerRef.current = window.setInterval(() => setElapsed((v) => v + 1), 1000);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "tr-TR"; recognition.continuous = true; recognition.interimResults = true;
        const finals = new Map<number, string>();
        const commitFinals = () => {
          const finalText = [...finals.keys()].sort((a, b) => a - b).map((k) => finals.get(k)).filter(Boolean).join(" ").trim();
          if (finalText) committedTranscriptRef.current = `${committedTranscriptRef.current} ${finalText}`.trim();
          finals.clear();
          if (committedTranscriptRef.current) setTranscript(committedTranscriptRef.current);
        };
        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const text = event.results[i][0].transcript.trim();
            if (event.results[i].isFinal) finals.set(i, text); else interim = text;
          }
          const finalText = [...finals.keys()].sort((a, b) => a - b).map((k) => finals.get(k)).filter(Boolean).join(" ");
          setTranscript(`${committedTranscriptRef.current} ${finalText} ${interim}`.trim());
        };
        recognition.onerror = (event: any) => {
          const code = String(event?.error || "");
          if (code === "not-allowed" || code === "service-not-allowed") {
            speechBlockedRef.current = true;
            setMessage("Ses kaydı devam ediyor ancak konuşmayı yazıya çevirme izni kapalı. Tarayıcı mikrofon/konuşma izinlerini kontrol et.");
          } else if (code === "network") {
            setMessage("Ses kaydı devam ediyor ancak konuşmayı yazıya çevirme servisine ulaşılamadı. İnternet bağlantısını kontrol edip tekrar dene.");
          } else if (code !== "no-speech" && code !== "aborted") {
            setMessage(`Ses kaydı devam ediyor ancak konuşma tanıma hatası oluştu${code ? `: ${code}` : "."}`);
          }
        };
        recognition.onend = () => {
          commitFinals();
          if (!recordingRef.current || speechBlockedRef.current) return;
          window.setTimeout(() => {
            if (!recordingRef.current || speechBlockedRef.current) return;
            try { recognition.start(); } catch { /* already starting */ }
          }, 250);
        };
        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch {
          setMessage("Ses kaydı başladı ancak konuşmayı yazıya çevirme başlatılamadı. Tarayıcıyı yenileyip tekrar dene.");
        }
      } else {
        setMessage("Ses kaydı başladı ancak bu tarayıcı konuşmayı yazıya çevirme özelliğini desteklemiyor. Chrome/Edge üzerinde tekrar deneyebilirsin; kaydı yine not olarak saklayabilirsin.");
      }
    } catch { setMessage("Mikrofon izni alınamadı. Tarayıcı veya uygulama izinlerini kontrol et."); }
  };

  const stop = () => {
    recordingRef.current = false;
    recorderRef.current?.stop(); recognitionRef.current?.stop?.(); recognitionRef.current = null; setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null;
  };

  const save = async () => {
    if (!blob) return;
    setSaving(true); setMessage("");
    try {
      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("wav") ? "wav" : "webm";
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });
      const fileId = ID.unique();
      await storage.createFile({ bucketId: config.voiceBucketId, fileId, file, permissions: ownerPermissions(user.$id) });
      const clean = transcript.trim();
      await tablesDB.createRow({ databaseId: config.databaseId, tableId: config.notesTableId, rowId: ID.unique(), data: { title: clean ? clean.slice(0, 70) : "Sesli not", body: clean, plainText: clean, kind: "voice", pinned: false, archived: false, audioFileId: fileId, duration: elapsed, transcript: clean }, permissions: ownerPermissions(user.$id) });
      await onSaved();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Sesli not kaydedilemedi."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Sesli not" title="Konuşurken düşünceyi kaçırma" description="Kayıt sırasında oluşan metni durdurduktan sonra düzenleyebilir, sonra tek not olarak saklayabilirsin." />
      <section className="voice-stage glass-card">
        <div className={`record-orbit ${recording ? "recording" : ""}`}><button className="record-button" onClick={recording ? stop : start} aria-label={recording ? "Kaydı durdur" : "Kaydı başlat"}>{recording ? <Square size={30} fill="currentColor" /> : <Mic size={34} />}</button></div>
        <div className={`voice-bars ${recording ? "active" : ""}`} aria-hidden="true">{Array.from({ length: 15 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 70}ms` }} />)}</div>
        <div className="record-status"><strong>{recording ? "Dinliyorum" : blob ? "Kayıt hazır" : "Kayda hazır"}</strong><span>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</span></div>
        <textarea className="transcript-box" value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Konuşma metni burada oluşur. Kayıt sonrasında dilediğin gibi düzenleyebilirsin." />
        {message && <p className="form-error">{message}</p>}
        <div className="voice-actions">{recording && <button className="secondary-button" onClick={stop}><Pause size={17} /> Durdur</button>}<button className="primary-button" disabled={!blob || recording || saving} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />} Notlara kaydet</button></div>
      </section>
    </>
  );
}

function CalendarView({ user, events, onRefresh }: { user: AppUser; events: CalendarEvent[]; onRefresh: () => Promise<void> }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(isoToLocalInput());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const monthName = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(month);
  const firstOffset = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstOffset + days }, (_, i) => (i < firstOffset ? null : new Date(month.getFullYear(), month.getMonth(), i - firstOffset + 1)));
  const keyFor = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const eventsByDay = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => { const d = new Date(ev.startAt); const k = keyFor(d); (acc[k] ||= []).push(ev); return acc; }, {}), [events]);

  const openDay = (d: Date) => { setSelectedDay(d); const n = new Date(d); n.setHours(Math.max(new Date().getHours() + 1, 9), 0, 0, 0); setStartAt(isoToLocalInput(n.toISOString())); setTitle(""); setNote(""); };
  const add = async (e: FormEvent) => { e.preventDefault(); setSaving(true); try { await tablesDB.createRow({ databaseId: config.databaseId, tableId: config.eventsTableId, rowId: ID.unique(), data: { title: title.trim(), startAt: localInputToIso(startAt), allDay: false, note, color: "violet" }, permissions: ownerPermissions(user.$id) }); await onRefresh(); setSelectedDay(null); } finally { setSaving(false); } };
  const remove = async (id: string) => { await tablesDB.deleteRow({ databaseId: config.databaseId, tableId: config.eventsTableId, rowId: id }); await onRefresh(); };

  return (
    <>
      <PageHeader eyebrow="Takvim" title="Günlerini görünür hale getir" description="Ay görünümünde tarihleri işaretle; önemli kayıtlar notlarınla aynı kişisel alanda kalsın." />
      <section className="calendar-card glass-card">
        <div className="calendar-head"><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Önceki ay"><ChevronLeft /></button><h2>{monthName}</h2><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Sonraki ay"><ChevronRight /></button></div>
        <div className="weekday-row">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="month-grid">{cells.map((d, i) => d ? <button key={keyFor(d)} className={`day-cell ${keyFor(d) === keyFor(new Date()) ? "today" : ""}`} onClick={() => openDay(d)}><span className="day-number">{d.getDate()}</span><div className="event-dots">{(eventsByDay[keyFor(d)] || []).slice(0, 3).map((ev) => <span key={ev.$id} title={ev.title}>{ev.title}</span>)}</div></button> : <div key={`blank-${i}`} className="day-cell blank" />)}</div>
      </section>
      <Panel title="Yaklaşan kayıtlar">{events.filter((e) => new Date(e.startAt) >= new Date()).slice(0, 8).map((ev) => <div className="event-row" key={ev.$id}><div><strong>{ev.title}</strong><span>{formatDate(ev.startAt)}</span></div><button className="icon-button danger" onClick={() => void remove(ev.$id)} aria-label={`${ev.title} kaydını sil`}><Trash2 size={16} /></button></div>)}</Panel>
      {selectedDay && <Modal onClose={() => setSelectedDay(null)} title={`${selectedDay.getDate()} ${new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(selectedDay)}`}><form className="stack-form" onSubmit={add}><label>Başlık<input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus /></label><label>Tarih ve saat<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required /></label><label>Not<textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Takvime ekle</button></form></Modal>}
    </>
  );
}

function ToolsView() {
  const [qrValue, setQrValue] = useState("https://");
  const [pdfTitle, setPdfTitle] = useState("Notum");
  const [pdfText, setPdfText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [mediaError, setMediaError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioName, setAudioName] = useState("ses.mp3");
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg"); if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg); const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "alive-qr.svg"; a.click(); URL.revokeObjectURL(a.href);
  };
  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" }); doc.setFontSize(20); doc.text(pdfTitle || "Belge", 18, 22); doc.setFontSize(11); const lines = doc.splitTextToSize(pdfText || "", 174); doc.text(lines, 18, 34); doc.save(`${(pdfTitle || "belge").replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`);
  };

  const extractAudio = async () => {
    if (!mediaFile) return;
    setMediaBusy(true);
    setMediaError("");
    setMediaProgress(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }

    try {
      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => setMediaProgress(Math.max(0, Math.min(100, Math.round(progress * 100)))));

      const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm"),
      });

      const extension = mediaFile.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "media";
      const inputName = `input.${extension}`;
      const outputName = "audio.mp3";
      await ffmpeg.writeFile(inputName, await fetchFile(mediaFile));
      const exitCode = await ffmpeg.exec(["-i", inputName, "-vn", "-codec:a", "libmp3lame", "-q:a", "2", outputName]);
      if (exitCode !== 0) throw new Error("Bu dosyanın ses parçası dönüştürülemedi.");

      const data = await ffmpeg.readFile(outputName);
      const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
      const audioBytes = new Uint8Array(bytes.byteLength);
      audioBytes.set(bytes);
      const blob = new Blob([audioBytes.buffer], { type: "audio/mpeg" });
      const nextUrl = URL.createObjectURL(blob);
      const baseName = mediaFile.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ _-]+/g, "").trim() || "ses";
      setAudioName(`${baseName}.mp3`);
      setAudioUrl(nextUrl);
      setMediaProgress(100);
      ffmpeg.terminate();
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Ses çıkarma tamamlanamadı.");
    } finally {
      setMediaBusy(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = audioName;
    a.click();
  };

  return (
    <>
      <PageHeader eyebrow="Araç merkezi" title="Küçük işler için ayrı uygulama arama" description="Sık kullandığın araçlar aynı arayüzde; yeni modüller bu merkeze eklenebilir." />
      <section className="tools-grid">
        <article className="tool-card glass-card"><div className="tool-card-head"><div className="tool-icon"><QrCode /></div><div><h2>QR oluştur</h2><p>Metin veya bağlantıyı anında QR’a çevir.</p></div></div><label>İçerik<input value={qrValue} onChange={(e) => setQrValue(e.target.value)} /></label><div className="qr-preview" ref={qrRef}><QRCodeSVG value={qrValue || " "} size={180} level="M" bgColor="transparent" fgColor="#24194f" /></div><button className="secondary-button" onClick={downloadQr}><Download size={17} /> SVG indir</button></article>
        <article className="tool-card glass-card"><div className="tool-card-head"><div className="tool-icon"><FileText /></div><div><h2>Metinden PDF</h2><p>Hızlı bir metni sade PDF dosyasına dönüştür.</p></div></div><label>Belge adı<input value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} /></label><label>Metin<textarea rows={8} value={pdfText} onChange={(e) => setPdfText(e.target.value)} placeholder="PDF'e dönüşecek metin…" /></label><button className="secondary-button" onClick={downloadPdf}><Download size={17} /> PDF indir</button></article>
        <article className="tool-card glass-card media-tool-card">
          <div className="tool-card-head"><div className="tool-icon"><FileAudio /></div><div><h2>Medyadan MP3 çıkar</h2><p>Sana ait veya kullanım iznin olan ses/video dosyasını cihazında MP3’e dönüştür.</p></div></div>
          <label className="media-drop">
            <span>{mediaFile ? mediaFile.name : "Ses veya video dosyası seç"}</span>
            <small>{mediaFile ? `${(mediaFile.size / 1024 / 1024).toFixed(1)} MB` : "MP4, MOV, WEBM, MP3, M4A ve tarayıcının okuyabildiği diğer medya dosyaları"}</small>
            <input type="file" accept="audio/*,video/*" onChange={(e) => { setMediaFile(e.target.files?.[0] || null); setMediaError(""); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(""); } }} />
          </label>
          {mediaBusy && <div className="media-progress"><div className="media-progress-bar"><span style={{ width: `${Math.max(mediaProgress, 4)}%` }} /></div><span>{mediaProgress < 5 ? "Dönüştürme motoru hazırlanıyor" : `%${mediaProgress}`}</span></div>}
          {mediaError && <p className="form-error">{mediaError}</p>}
          {audioUrl && <div className="media-result"><audio controls src={audioUrl} /><button className="secondary-button" onClick={downloadAudio}><Download size={17} /> {audioName} indir</button></div>}
          <button className="primary-button" disabled={!mediaFile || mediaBusy} onClick={() => void extractAudio()}>{mediaBusy ? <LoaderCircle className="spin" size={18} /> : <FileAudio size={18} />}{mediaBusy ? "Dönüştürülüyor" : "MP3 çıkar"}</button>
        </article>
        <article className="tool-card glass-card roadmap-card"><div className="tool-card-head"><div className="tool-icon"><MoreHorizontal /></div><div><h2>Genişlemeye hazır</h2><p>Görsel sıkıştırma, dosya dönüştürme ve renk araçları aynı merkez yapısına eklenebilir.</p></div></div><div className="chip-row"><span>Görsel</span><span>Dosya</span><span>Metin</span><span>Medya</span></div></article>
      </section>
    </>
  );
}

function Brand({ compact = false }: { compact?: boolean }) { return <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div>{!compact && <div><strong>Alive</strong><span>kişisel asistan</span></div>}<b className="mobile-brand-name">Alive</b></div>; }
function NavButton({ active, onClick, icon, label, compact = false }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; compact?: boolean }) { return <button className={`nav-button ${active ? "active" : ""} ${compact ? "compact" : ""}`} onClick={onClick}>{icon}<span>{label}</span></button>; }
function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</header>; }
function QuickAction({ icon, title, text, onClick, accent = false }: { icon: ReactNode; title: string; text: string; onClick: () => void; accent?: boolean }) { return <button className={`quick-action ${accent ? "accent" : ""}`} onClick={onClick}><div className="quick-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div><ChevronRight size={18} /></button>; }
function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <section className="panel glass-card"><div className="panel-head"><h2>{title}</h2>{action}</div><div className="panel-body">{children}</div></section>; }
function MiniRow({ icon, title, meta }: { icon: ReactNode; title: string; meta: string }) { return <div className="mini-row"><div className="mini-icon">{icon}</div><div><strong>{title}</strong><span>{meta}</span></div></div>; }
function EmptyMini({ text }: { text: string }) { return <div className="empty-mini"><Sparkles size={17} /><span>{text}</span></div>; }
function ThemePicker({ theme, onChange, compact = false }: { theme: ThemeId; onChange: (theme: ThemeId) => void; compact?: boolean }) {
  if (compact) {
    const currentIndex = themeOptions.findIndex((option) => option.id === theme);
    const nextTheme = themeOptions[(currentIndex + 1) % themeOptions.length];
    return <button className="mobile-theme-cycle" onClick={() => onChange(nextTheme.id)} title={`${nextTheme.label} temasına geç`} aria-label={`${nextTheme.label} temasına geç`}><Palette size={17} /><span className={`theme-preview theme-${theme}`} /></button>;
  }
  return <div className="theme-picker"><Palette size={16} />{themeOptions.map((option) => <button key={option.id} className={`theme-dot theme-${option.id} ${theme === option.id ? "active" : ""}`} onClick={() => onChange(option.id)} title={option.label} aria-label={`${option.label} temasını kullan`} />)}</div>;
}
function PersonalSpaceCard({ theme, onThemeChange }: { theme: ThemeId; onThemeChange: (theme: ThemeId) => void }) { return <section className="personal-space-card"><div className="personal-space-icon"><Sparkles size={16} /></div><div><strong>Alanının havası</strong><span>Rengi anında değiştir.</span></div><ThemePicker theme={theme} onChange={onThemeChange} /></section>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><section className="modal glass-card"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><X size={18} /></button></div>{children}</section></div>; }
function CenteredLoader({ label }: { label: string }) { return <div className="center-loader"><LoaderCircle className="spin" /><span>{label}</span></div>; }

export default App;
