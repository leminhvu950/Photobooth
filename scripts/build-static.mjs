import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = path.join(projectRoot, "dist");
const publicFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "icon.svg",
  "manifest.webmanifest",
  "sw.js",
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await Promise.all(
  publicFiles.map((file) => cp(path.join(projectRoot, file), path.join(outputDirectory, file))),
);
await cp(path.join(projectRoot, "admin"), path.join(outputDirectory, "admin"), { recursive: true });

console.log(`Built ${publicFiles.length + 3} SnapJoy assets in ${outputDirectory}`);
