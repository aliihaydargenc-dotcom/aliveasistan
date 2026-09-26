import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Home,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mic,
  MoreHorizontal,
  NotebookPen,
  Pause,
  Pin,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Square,
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
        <div className="sidebar-footer">
          <div className="avatar">{(user.name || user.email || "A").slice(0, 1).toLocaleUpperCase("tr-TR")}</div>
          <div className="user-copy"><strong>{user.name || "Kişisel alan"}</strong><span>{user.email || "Güvenli oturum"}</span></div>
          <button className="icon-button" onClick={logout} aria-label="Çıkış"><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="main-stage">
        <header className="mobile-header glass"><Brand compact /><button className="icon-button" onClick={logout} aria-label="Çıkış"><LogOut size={18} /></button></header>
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
      <section className="login-card glass">
        <div className="login-mark"><Sparkles size={25} /></div>
        <div><p className="eyebrow">Kişisel çalışma alanı</p><h1>Alive Asistan</h1><p className="muted">Notların, ses kayıtların, takvimin ve araçların tek güvenli alanda.</p></div>
        <form onSubmit={submit} className="login-form">
          <label>E-posta<input autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Parola<input autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}{busy ? "Giriş yapılıyor" : "Giriş yap"}</button>
        </form>
      </section>
    </div>
  );
}

function HomeView({ user, notes, events, onView, onRefresh }: { user: AppUser; notes: Note[]; events: CalendarEvent[]; onView: (v: ViewId) => void; onRefresh: () => Promise<void> }) {
  const upcoming = events.filter((e) => new Date(e.startAt) >= new Date()).slice(0, 3);
  const pinned = notes.filter((n) => n.pinned).slice(0, 3);
  const today = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <>
      <PageHeader eyebrow={today} title={`Merhaba${user.name ? `, ${user.name.split(" ")[0]}` : ""}`} description="Bugün neyi yakalamak istiyorsun?" />
      <section className="quick-grid">
        <QuickAction icon={<NotebookPen />} title="Yeni not" text="Düşünceyi kaybetmeden yaz." onClick={() => onView("notes")} />
        <QuickAction accent icon={<Mic />} title="Sesle yakala" text="Konuş, metni düzenle ve sakla." onClick={() => onView("voice")} />
        <QuickAction icon={<CalendarDays />} title="Takvime ekle" text="Bir tarihi hemen işaretle." onClick={() => onView("calendar")} />
        <QuickAction icon={<QrCode />} title="Hızlı araç" text="QR ve PDF araçlarını aç." onClick={() => onView("tools")} />
      </section>
      <section className="two-col">
        <Panel title="Sabit notlar" action={<button className="text-button" onClick={() => onView("notes")}>Tümü</button>}>
          {pinned.length ? pinned.map((n) => <MiniRow key={n.$id} icon={<Pin size={15} />} title={n.title} meta={formatDate(n.$updatedAt)} />) : <EmptyMini text="Henüz sabitlenmiş not yok." />}
        </Panel>
        <Panel title="Yaklaşanlar" action={<button className="text-button" onClick={() => onView("calendar")}>Takvim</button>}>
          {upcoming.length ? upcoming.map((e) => <MiniRow key={e.$id} icon={<CalendarDays size={15} />} title={e.title} meta={formatDate(e.startAt)} />) : <EmptyMini text="Yaklaşan takvim kaydı yok." />}
        </Panel>
      </section>
      <button className="refresh-link" onClick={() => void onRefresh()}>Verileri yenile</button>
    </>
  );
}

function NotesView({ user, notes, onRefresh }: { user: AppUser; notes: Note[]; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Note | null>(notes[0] || null);
  const [draft, setDraft] = useState({ title: selected?.title || "", body: selected?.body || "", pinned: !!selected?.pinned });
  const [saving, setSaving] = useState(false);
  const [mobileEditor, setMobileEditor] = useState(false);

  useEffect(() => {
    if (selected) setDraft({ title: selected.title, body: selected.body || "", pinned: !!selected.pinned });
  }, [selected]);

  const filtered = notes.filter((n) => `${n.title} ${n.plainText || n.body || ""}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  const newNote = () => { setSelected(null); setDraft({ title: "", body: "", pinned: false }); setMobileEditor(true); };
  const choose = (n: Note) => { setSelected(n); setMobileEditor(true); };

  const save = async () => {
    if (!draft.title.trim() && !draft.body.trim()) return;
    setSaving(true);
    const data = { title: draft.title.trim() || "İsimsiz not", body: draft.body, plainText: draft.body.replace(/<[^>]+>/g, " ").trim(), kind: "note", pinned: draft.pinned, archived: false };
    try {
      if (selected) {
        await tablesDB.updateRow({ databaseId: config.databaseId, tableId: config.notesTableId, rowId: selected.$id, data });
      } else {
        await tablesDB.createRow({ databaseId: config.databaseId, tableId: config.notesTableId, rowId: ID.unique(), data, permissions: ownerPermissions(user.$id) });
      }
      await onRefresh(); setMobileEditor(false);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!selected) return;
    await tablesDB.deleteRow({ databaseId: config.databaseId, tableId: config.notesTableId, rowId: selected.$id });
    setSelected(null); setDraft({ title: "", body: "", pinned: false }); await onRefresh(); setMobileEditor(false);
  };

  return (
    <>
      <PageHeader eyebrow="Not defteri" title="Düşüncelerin için ferah bir alan" description="Hızlı yaz, ara, sabitle ve cihazların arasında aynı notlara ulaş." action={<button className="primary-button compact-btn" onClick={newNote}><Plus size={17} /> Yeni not</button>} />
      <div className={`notes-workspace ${mobileEditor ? "editor-open" : ""}`}>
        <section className="notes-list glass-card">
          <div className="search-box"><Search size={17} /><input placeholder="Notlarda ara" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="note-cards">
            {filtered.map((n) => <button key={n.$id} className={`note-card ${selected?.$id === n.$id ? "active" : ""}`} onClick={() => choose(n)}><div className="note-card-title"><strong>{n.title}</strong>{n.pinned && <Pin size={14} />}</div><p>{(n.plainText || n.body || "Boş not").slice(0, 100)}</p><span>{formatDate(n.$updatedAt)}</span></button>)}
            {!filtered.length && <EmptyMini text="Bu aramada not bulunamadı." />}
          </div>
        </section>
        <section className="editor-pane glass-card">
          <div className="editor-toolbar">
            <button className="mobile-back" onClick={() => setMobileEditor(false)}><ChevronLeft size={18} /> Notlar</button>
            <button className={`tool-button ${draft.pinned ? "active" : ""}`} onClick={() => setDraft((d) => ({ ...d, pinned: !d.pinned }))}><Pin size={16} /> Sabitle</button>
            <div className="spacer" />
            {selected && <button className="icon-button danger" onClick={() => void remove()} aria-label="Notu sil"><Trash2 size={17} /></button>}
            <button className="primary-button compact-btn" onClick={() => void save()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Kaydet</button>
          </div>
          <input className="note-title-input" placeholder="Not başlığı" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          <textarea className="note-body-input" placeholder="Buraya yazmaya başla…" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          <div className="editor-foot"><span>{draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0} kelime</span><span>{selected ? `Son düzenleme ${formatDate(selected.$updatedAt)}` : "Yeni not"}</span></div>
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

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); recognitionRef.current?.stop?.(); recorderRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    setMessage(""); setBlob(null); setElapsed(0); setTranscript(""); chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => { setBlob(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })); stream.getTracks().forEach((t) => t.stop()); };
      recorder.start(500); setRecording(true);
      timerRef.current = window.setInterval(() => setElapsed((v) => v + 1), 1000);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = "tr-TR"; recognition.continuous = true; recognition.interimResults = true;
        const finals = new Map<number, string>();
        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const text = event.results[i][0].transcript.trim();
            if (event.results[i].isFinal) finals.set(i, text); else interim = text;
          }
          setTranscript(`${[...finals.keys()].sort((a, b) => a - b).map((k) => finals.get(k)).join(" ")} ${interim}`.trim());
        };
        recognitionRef.current = recognition; recognition.start();
      }
    } catch { setMessage("Mikrofon izni alınamadı. Tarayıcı veya uygulama izinlerini kontrol et."); }
  };

  const stop = () => {
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
        <div className="calendar-head"><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button><h2>{monthName}</h2><button className="icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button></div>
        <div className="weekday-row">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="month-grid">{cells.map((d, i) => d ? <button key={keyFor(d)} className={`day-cell ${keyFor(d) === keyFor(new Date()) ? "today" : ""}`} onClick={() => openDay(d)}><span className="day-number">{d.getDate()}</span><div className="event-dots">{(eventsByDay[keyFor(d)] || []).slice(0, 3).map((ev) => <span key={ev.$id} title={ev.title}>{ev.title}</span>)}</div></button> : <div key={`blank-${i}`} className="day-cell blank" />)}</div>
      </section>
      <Panel title="Yaklaşan kayıtlar">{events.filter((e) => new Date(e.startAt) >= new Date()).slice(0, 8).map((ev) => <div className="event-row" key={ev.$id}><div><strong>{ev.title}</strong><span>{formatDate(ev.startAt)}</span></div><button className="icon-button danger" onClick={() => void remove(ev.$id)}><Trash2 size={16} /></button></div>)}</Panel>
      {selectedDay && <Modal onClose={() => setSelectedDay(null)} title={`${selectedDay.getDate()} ${new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(selectedDay)}`}><form className="stack-form" onSubmit={add}><label>Başlık<input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus /></label><label>Tarih ve saat<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required /></label><label>Not<textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Takvime ekle</button></form></Modal>}
    </>
  );
}

function ToolsView() {
  const [qrValue, setQrValue] = useState("https://");
  const [pdfTitle, setPdfTitle] = useState("Notum");
  const [pdfText, setPdfText] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg"); if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg); const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "alive-qr.svg"; a.click(); URL.revokeObjectURL(a.href);
  };
  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" }); doc.setFontSize(20); doc.text(pdfTitle || "Belge", 18, 22); doc.setFontSize(11); const lines = doc.splitTextToSize(pdfText || "", 174); doc.text(lines, 18, 34); doc.save(`${(pdfTitle || "belge").replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`);
  };
  return (
    <>
      <PageHeader eyebrow="Araç merkezi" title="Küçük işler için ayrı uygulama arama" description="Sık kullandığın araçlar aynı arayüzde; yeni modüller bu merkeze eklenebilir." />
      <section className="tools-grid">
        <article className="tool-card glass-card"><div className="tool-card-head"><div className="tool-icon"><QrCode /></div><div><h2>QR oluştur</h2><p>Metin veya bağlantıyı anında QR’a çevir.</p></div></div><label>İçerik<input value={qrValue} onChange={(e) => setQrValue(e.target.value)} /></label><div className="qr-preview" ref={qrRef}><QRCodeSVG value={qrValue || " "} size={180} level="M" bgColor="transparent" fgColor="#24194f" /></div><button className="secondary-button" onClick={downloadQr}><Download size={17} /> SVG indir</button></article>
        <article className="tool-card glass-card"><div className="tool-card-head"><div className="tool-icon"><FileText /></div><div><h2>Metinden PDF</h2><p>Hızlı bir metni sade PDF dosyasına dönüştür.</p></div></div><label>Belge adı<input value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} /></label><label>Metin<textarea rows={8} value={pdfText} onChange={(e) => setPdfText(e.target.value)} placeholder="PDF'e dönüşecek metin…" /></label><button className="secondary-button" onClick={downloadPdf}><Download size={17} /> PDF indir</button></article>
        <article className="tool-card glass-card roadmap-card"><div className="tool-card-head"><div className="tool-icon"><MoreHorizontal /></div><div><h2>Genişlemeye hazır</h2><p>Görsel sıkıştırma, dosya dönüştürme, renk araçları ve kullanıcıya ait medya dosyalarından ses çıkarma aynı merkez yapısına eklenebilir.</p></div></div><div className="chip-row"><span>Görsel</span><span>Dosya</span><span>Metin</span><span>Medya</span></div></article>
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
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><section className="modal glass-card"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></div>{children}</section></div>; }
function CenteredLoader({ label }: { label: string }) { return <div className="center-loader"><LoaderCircle className="spin" /><span>{label}</span></div>; }

export default App;
