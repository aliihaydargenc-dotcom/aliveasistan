import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Compressor from "compressorjs";
import { jsPDF } from "jspdf";
import {
  Braces,
  Check,
  Clipboard,
  Download,
  FileAudio,
  FileCheck2,
  FileText,
  ImageDown,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Type,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 102_400 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const safeFileName = (value: string, fallback: string) => {
  const name = value.trim().replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ _-]+/g, "-").replace(/\s+/g, "-");
  return name || fallback;
};

const triggerDownload = (url: string, name: string, revoke = false) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  if (revoke) window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function ToolCard({ icon, title, description, children, className = "" }: { icon: ReactNode; title: string; description: string; children: ReactNode; className?: string }) {
  return (
    <article className={`tool-card glass-card ${className}`}>
      <div className="tool-card-head"><div className="tool-icon">{icon}</div><div><h2>{title}</h2><p>{description}</p></div></div>
      {children}
    </article>
  );
}

function CopyButton({ value, label = "Kopyala" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await copyText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  };
  return <button className="secondary-button" disabled={!value} onClick={() => void copy()}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Kopyalandı" : label}</button>;
}

export function ToolsView() {
  const [qrValue, setQrValue] = useState("https://");
  const [pdfTitle, setPdfTitle] = useState("Notum");
  const [pdfText, setPdfText] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQrSvg = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([data], { type: "image/svg+xml;charset=utf-8" }));
    triggerDownload(url, "alive-qr.svg", true);
  };

  const downloadQrPng = async () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const sourceUrl = URL.createObjectURL(new Blob([data], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024; canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(image, 64, 64, 896, 896);
      canvas.toBlob((blob) => blob && triggerDownload(URL.createObjectURL(blob), "alive-qr.png", true), "image/png");
      URL.revokeObjectURL(sourceUrl);
    };
    image.src = sourceUrl;
  };

  const downloadPdf = () => {
    const title = pdfTitle.trim() || "Belge";
    const body = pdfText || " ";
    const canvas = document.createElement("canvas");
    const width = 1240; const height = 1754; const margin = 110; const lineHeight = 34;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const measure = (text: string) => {
      const words = text.split(/\s+/); const lines: string[] = []; let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > width - margin * 2 && line) { lines.push(line); line = word; } else line = next;
      }
      lines.push(line);
      return lines;
    };
    ctx.font = "28px Arial, sans-serif";
    const lines = body.split("\n").flatMap((paragraph) => paragraph ? measure(paragraph) : [""]);
    const firstPageCapacity = Math.floor((height - 260) / lineHeight);
    const nextPageCapacity = Math.floor((height - margin * 2) / lineHeight);
    const pages: string[][] = [];
    pages.push(lines.splice(0, firstPageCapacity));
    while (lines.length) pages.push(lines.splice(0, nextPageCapacity));
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    pages.forEach((pageLines, index) => {
      if (index) doc.addPage();
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height);
      let y = margin;
      if (index === 0) {
        ctx.fillStyle = "#24194f"; ctx.font = "bold 52px Arial, sans-serif"; ctx.fillText(title, margin, y);
        y += 95;
      }
      ctx.fillStyle = "#272230"; ctx.font = "28px Arial, sans-serif";
      pageLines.forEach((line) => { ctx.fillText(line, margin, y); y += lineHeight; });
      doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    });
    doc.save(`${safeFileName(title, "belge")}.pdf`);
  };

  return (
    <>
      <header className="page-header"><div><p className="eyebrow">Araç merkezi</p><h1>Dosyan sende, işlem cihazında.</h1><p className="page-description">API anahtarı, üyelik veya sunucuya yükleme yok. Araçlar doğrudan tarayıcında çalışır.</p></div></header>
      <div className="local-tools-banner"><ShieldCheck size={18} /><div><strong>Yerel ve özel</strong><span>Seçtiğin dosyalar cihazından ayrılmaz.</span></div><div className="local-badges"><span>7 gerçek araç</span><span>API yok</span><span>Ücretsiz</span></div></div>
      <section className="tools-grid">
        <ToolCard icon={<QrCode />} title="QR oluştur" description="Metin veya bağlantıyı SVG ya da yüksek kaliteli PNG olarak indir.">
          <label>İçerik<input value={qrValue} onChange={(e) => setQrValue(e.target.value)} /></label>
          <div className="qr-preview" ref={qrRef}><QRCodeSVG value={qrValue || " "} size={180} level="M" bgColor="transparent" fgColor="#24194f" /></div>
          <div className="tool-actions"><button className="secondary-button" onClick={downloadQrSvg}><Download size={17} /> SVG indir</button><button className="secondary-button" onClick={() => void downloadQrPng()}><Download size={17} /> PNG indir</button></div>
        </ToolCard>
        <ToolCard icon={<FileText />} title="Metinden PDF" description="Türkçe karakterleri koruyan, çok sayfalı sade PDF hazırla.">
          <label>Belge adı<input value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} /></label>
          <label>Metin<textarea rows={8} value={pdfText} onChange={(e) => setPdfText(e.target.value)} placeholder="PDF'e dönüşecek metin…" /></label>
          <button className="secondary-button" disabled={!pdfText.trim()} onClick={downloadPdf}><Download size={17} /> PDF indir</button>
        </ToolCard>
        <ImageOptimizer />
        <MediaToMp3 />
        <JsonTool />
        <TextTool />
        <FileHashTool />
      </section>
    </>
  );
}

function ImageOptimizer() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [format, setFormat] = useState<ImageFormat>("image/webp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const inputUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);

  useEffect(() => () => { if (inputUrl) URL.revokeObjectURL(inputUrl); }, [inputUrl]);
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] || null); setError("");
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
  };
  const compress = () => {
    if (!file) return;
    setBusy(true); setError("");
    new Compressor(file, {
      quality: quality / 100,
      maxWidth: maxWidth || Infinity,
      mimeType: format,
      convertTypes: ["image/png", "image/bmp"],
      convertSize: 0,
      success(blob) {
        if (result?.url) URL.revokeObjectURL(result.url);
        const extension = format.split("/")[1].replace("jpeg", "jpg");
        const name = `${safeFileName(file.name.replace(/\.[^.]+$/, ""), "gorsel")}.${extension}`;
        setResult({ blob, url: URL.createObjectURL(blob), name }); setBusy(false);
      },
      error(reason) { setError(reason.message || "Görsel işlenemedi."); setBusy(false); },
    });
  };
  const saving = result && file ? Math.round((1 - result.blob.size / file.size) * 100) : 0;

  return (
    <ToolCard icon={<ImageDown />} title="Görseli küçült ve dönüştür" description="MIT lisanslı CompressorJS ile boyut, kalite ve formatı cihazında değiştir." className="featured-tool">
      <label className="media-drop"><span>{file ? file.name : "JPG, PNG, WebP veya BMP seç"}</span><small>{file ? formatBytes(file.size) : "Görsel sunucuya gönderilmez"}</small><input type="file" accept="image/jpeg,image/png,image/webp,image/bmp" onChange={choose} /></label>
      <div className="image-settings">
        <label>En uzun kenar<input type="number" min="320" max="8000" step="100" value={maxWidth} onChange={(e) => setMaxWidth(Number(e.target.value))} /><small>piksel</small></label>
        <label>Format<select value={format} onChange={(e) => setFormat(e.target.value as ImageFormat)}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
      </div>
      <label className="range-label"><span>Kalite</span><strong>%{quality}</strong><input type="range" min="30" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></label>
      {error && <p className="form-error">{error}</p>}
      {result && file && <div className="image-result"><div className="image-comparison"><img src={inputUrl} alt="Orijinal görsel" /><img src={result.url} alt="Dönüştürülmüş görsel" /></div><div className="result-stats"><span><small>Önce</small>{formatBytes(file.size)}</span><span><small>Sonra</small>{formatBytes(result.blob.size)}</span><strong className={saving >= 0 ? "positive" : "negative"}>{saving >= 0 ? `%${saving} daha küçük` : `%${Math.abs(saving)} daha büyük`}</strong></div><button className="secondary-button" onClick={() => triggerDownload(result.url, result.name)}><Download size={17} /> {result.name}</button></div>}
      <button className="primary-button" disabled={!file || busy} onClick={compress}>{busy ? <LoaderCircle className="spin" size={18} /> : <ImageDown size={18} />}{busy ? "İşleniyor" : "Görseli hazırla"}</button>
    </ToolCard>
  );
}

function MediaToMp3() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);

  const extract = async () => {
    if (!file) return;
    setBusy(true); setError(""); setProgress(0);
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress: value }) => setProgress(Math.max(0, Math.min(100, Math.round(value * 100)))));
      const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      await ffmpeg.load({ coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript"), wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm") });
      const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "media";
      const inputName = `input.${extension}`; const outputName = "audio.mp3";
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      const exitCode = await ffmpeg.exec(["-i", inputName, "-vn", "-codec:a", "libmp3lame", "-q:a", "2", outputName]);
      if (exitCode !== 0) throw new Error("Bu dosyanın ses parçası dönüştürülemedi.");
      const data = await ffmpeg.readFile(outputName);
      const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
      const copy = new Uint8Array(bytes.byteLength); copy.set(bytes);
      setResult({ url: URL.createObjectURL(new Blob([copy.buffer], { type: "audio/mpeg" })), name: `${safeFileName(file.name.replace(/\.[^.]+$/, ""), "ses")}.mp3` });
      setProgress(100); ffmpeg.terminate();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Ses çıkarma tamamlanamadı."); }
    finally { setBusy(false); }
  };

  return (
    <ToolCard icon={<FileAudio />} title="Medyadan MP3 çıkar" description="Sana ait ses veya videonun ses parçasını FFmpeg ile MP3'e dönüştür." className="media-tool-card">
      <label className="media-drop"><span>{file ? file.name : "Ses veya video dosyası seç"}</span><small>{file ? formatBytes(file.size) : "MP4, MOV, WEBM, MP3, M4A ve diğer yaygın formatlar"}</small><input type="file" accept="audio/*,video/*" onChange={(e) => { setFile(e.target.files?.[0] || null); setError(""); if (result?.url) URL.revokeObjectURL(result.url); setResult(null); }} /></label>
      {busy && <div className="media-progress"><div className="media-progress-bar"><span style={{ width: `${Math.max(progress, 4)}%` }} /></div><span>{progress < 5 ? "Motor hazırlanıyor" : `%${progress}`}</span></div>}
      {error && <p className="form-error">{error}</p>}
      {result && <div className="media-result"><audio controls src={result.url} /><button className="secondary-button" onClick={() => triggerDownload(result.url, result.name)}><Download size={17} /> {result.name}</button></div>}
      <button className="primary-button" disabled={!file || busy} onClick={() => void extract()}>{busy ? <LoaderCircle className="spin" size={18} /> : <FileAudio size={18} />}{busy ? "Dönüştürülüyor" : "MP3 çıkar"}</button>
    </ToolCard>
  );
}

function JsonTool() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const transform = (compact: boolean) => {
    try { setValue(JSON.stringify(JSON.parse(value), null, compact ? 0 : 2)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Geçersiz JSON."); }
  };
  return (
    <ToolCard icon={<Braces />} title="JSON düzenle" description="JSON verisini doğrula, okunur hale getir veya tek satıra küçült.">
      <textarea className="code-input" rows={10} value={value} onChange={(e) => { setValue(e.target.value); setError(""); }} spellCheck={false} placeholder={'{"durum":"hazır"}'} />
      {error && <p className="form-error">{error}</p>}
      <div className="tool-actions"><button className="secondary-button" disabled={!value.trim()} onClick={() => transform(false)}>Düzenle</button><button className="secondary-button" disabled={!value.trim()} onClick={() => transform(true)}>Küçült</button><CopyButton value={value} /></div>
    </ToolCard>
  );
}

function TextTool() {
  const [value, setValue] = useState("");
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const titleCase = () => setValue(value.toLocaleLowerCase("tr-TR").replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("tr-TR")));
  return (
    <ToolCard icon={<Type />} title="Metin atölyesi" description="Say, temizle ve büyük-küçük harf dönüşümlerini tek yerde yap.">
      <textarea rows={8} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Metnini buraya bırak…" />
      <div className="text-stats"><span><strong>{value.length}</strong> karakter</span><span><strong>{words}</strong> kelime</span><span><strong>{value.split(/\n/).length}</strong> satır</span></div>
      <div className="tool-actions wrap"><button className="secondary-button" onClick={() => setValue(value.toLocaleUpperCase("tr-TR"))}>BÜYÜK</button><button className="secondary-button" onClick={() => setValue(value.toLocaleLowerCase("tr-TR"))}>küçük</button><button className="secondary-button" onClick={titleCase}>Başlık</button><button className="secondary-button" onClick={() => setValue(value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim())}>Boşlukları temizle</button><CopyButton value={value} /></div>
    </ToolCard>
  );
}

function FileHashTool() {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const calculate = async () => {
    if (!file) return;
    setBusy(true); setHash("");
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      setHash(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
    } finally { setBusy(false); }
  };
  return (
    <ToolCard icon={<FileCheck2 />} title="Dosya parmak izi" description="Bir dosyanın SHA-256 imzasını hesapla; indirme veya yedek kopyayı doğrula." className="hash-tool">
      <label className="media-drop"><span>{file ? file.name : "Herhangi bir dosya seç"}</span><small>{file ? formatBytes(file.size) : "Hesaplama Web Crypto ile cihazında yapılır"}</small><input type="file" onChange={(e) => { setFile(e.target.files?.[0] || null); setHash(""); }} /></label>
      {hash && <output className="hash-output">{hash}</output>}
      <div className="tool-actions"><button className="primary-button" disabled={!file || busy} onClick={() => void calculate()}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{busy ? "Hesaplanıyor" : "SHA-256 hesapla"}</button><CopyButton value={hash} label="İmzayı kopyala" /></div>
    </ToolCard>
  );
}
