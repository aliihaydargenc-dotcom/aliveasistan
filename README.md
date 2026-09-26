# Alive Asistan

Mobil tabanı güçlü kişisel çalışma alanı: not, sesli not, takvim ve küçük araçlar aynı React kod tabanında çalışır. Web/PWA sürümü Appwrite Sites'ta, Android uygulaması Capacitor ile üretilecek şekilde hazırlanmıştır.

## İlk sürüm

- Appwrite e-posta/parola oturumu; uygulamada herkese açık kayıt ekranı yok.
- Satır bazlı yetkilendirilmiş kişisel notlar.
- Mobil ve masaüstüne ayrı uyarlanan not çalışma alanı.
- Mikrofon kaydı, desteklenen tarayıcılarda Türkçe konuşmayı metne çevirme ve kayıt sonrası metni düzenleme.
- Appwrite Storage üzerinde kullanıcıya özel ses dosyaları.
- Aylık takvim ve tarih işaretleme.
- QR oluşturma ve SVG indirme.
- Metinden PDF oluşturma.
- PWA manifest/service worker ve Android APK build hattı.

## Appwrite

Proje: `alive-asistan`
Region: `fra`
TablesDB: `alive`
Tablolar: `notes`, `events`
Storage: `voice-notes`
Android application id: `com.alihaydargenc.aliveasistan`

Uygulama herkese açık bir kayıt ekranı sunmaz. İlk kullanıcı Appwrite projesinde yönetici tarafından oluşturulduktan sonra yalnız e-posta/parola ile giriş yapılır.

## Geliştirme

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Android yerel hazırlık:

```bash
npm run build
npx cap add android
npm run android:patch
npx cap sync android
```

GitHub Actions her `main` push'unda web build'i doğrular ve `alive-asistan-debug-apk` artifact'i üretir.
