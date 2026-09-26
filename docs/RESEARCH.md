# Araştırma kararları

26 Eylül 2026 tarihli araştırmada tek kod tabanıyla web/PWA/Android hedefi için React + Vite + Capacitor seçildi. Appwrite React/Web dokümantasyonu istemci tarafı oturum, TablesDB ve Storage akışlarını destekliyor. Capacitor aynı web kodunu Android uygulamasına sarmalayabildiği için ayrı React Native kod tabanı açılmadı.

İncelenen açık kaynak seçenekleri arasında AppFlowy/Joplin sınıfı tam ürünler yerine mevcut ihtiyaca daha küçük bir çekirdek tercih edildi. BlockNote güçlü bir Notion-benzeri editör adayı olarak sonraki zengin metin aşaması için not edildi; ilk sürümde mobil klavye davranışı, bundle boyutu ve bakım yüzeyi daha kontrollü olsun diye yalın editör kullanıldı. Takvim tarafında React Big Calendar incelendi; mobil aylık işaretleme ihtiyacı için ilk sürüm özel ve daha hafif bir ay görünümüyle çözüldü.

Araç merkezi genişleyebilir bir modül alanı olarak tasarlandı. İlk sürümde QR ve PDF istemci tarafında çalışır. Medya araçları kullanıcıya ait veya kullanım izni bulunan dosyalarla sınırlı tutulmalıdır; üçüncü taraf platformlardan telifli içeriği indirmeye yönelik bir downloader çekirdeğe eklenmedi.
