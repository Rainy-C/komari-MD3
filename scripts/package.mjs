import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import { createHash } from "node:crypto";
const manifest = JSON.parse(await readFile("komari-theme.json", "utf8"));
if (manifest.short !== "MD3" || !manifest.name || !manifest.version)
  throw Error("Invalid theme metadata");
const files = {
  "komari-theme.json": strToU8(JSON.stringify(manifest, null, 2)),
};
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(path);
    else files[path] = new Uint8Array(await readFile(path));
  }
}
await walk("dist");
const html = await readFile("dist/index.html", "utf8");
for (const required of [
  "<title>Komari Monitor</title>",
  "A simple server monitor tool.",
  "</head>",
  "</body>",
])
  if (!html.includes(required))
    throw Error(`Missing Komari placeholder: ${required}`);
if (!html.includes("/themes/MD3/dist/assets/"))
  throw Error("Incorrect theme asset base");
await mkdir("release", { recursive: true });
const filename = `komari-Neumorph-v${manifest.version}.zip`;
const zip = zipSync(files, { level: 9 });
await writeFile(`release/${filename}`, zip);
await writeFile(
  `release/${filename}.sha256`,
  `${createHash("sha256").update(zip).digest("hex")}  ${filename}\n`,
);
console.log(`Packaged ${filename} (${zip.length} bytes)`);
