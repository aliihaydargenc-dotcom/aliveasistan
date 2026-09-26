import fs from "node:fs";

const manifest = "android/app/src/main/AndroidManifest.xml";
if (!fs.existsSync(manifest)) throw new Error("AndroidManifest.xml bulunamadı. Önce `npx cap add android` çalıştırılmalı.");
let xml = fs.readFileSync(manifest, "utf8");
const permission = '<uses-permission android:name="android.permission.RECORD_AUDIO" />';
if (!xml.includes("android.permission.RECORD_AUDIO")) xml = xml.replace("<application", `${permission}\n\n    <application`);
fs.writeFileSync(manifest, xml);

const gradleProperties = "android/gradle.properties";
if (fs.existsSync(gradleProperties)) {
  let props = fs.readFileSync(gradleProperties, "utf8");
  if (!props.includes("android.overridePathCheck=true")) {
    props = `${props.trimEnd()}\nandroid.overridePathCheck=true\n`;
    fs.writeFileSync(gradleProperties, props);
  }
}

console.log("Android microphone permission and Windows path compatibility ready.");
