// scripts/post-prebuild.js
const fs = require("fs");
const path = require("path");

const localPropertiesPath = path.join(__dirname, "..", "android", "local.properties");
const sdkDir = "/Users/adrian/Library/Android/sdk"; // ⚠️ usa tu ruta correcta

const content = `sdk.dir=${sdkDir}\n`;

try {
  fs.writeFileSync(localPropertiesPath, content);
  console.log("✅ local.properties restaurado automáticamente");
} catch (err) {
  console.error("❌ Error al crear local.properties:", err);
}

