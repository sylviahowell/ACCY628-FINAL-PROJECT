/**
 * Regenerate public/pod-samples/*.pdf (requires: npm i pdf-lib)
 * Run: node scripts/generate-pod-samples.mjs
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "public", "pod-samples");

async function make(title, file) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText("RowanLane", {
    x: 72,
    y: 720,
    size: 22,
    font: bold,
    color: rgb(0.1, 0.2, 0.35),
  });
  page.drawText("Proof of Delivery / Signed BOL", { x: 72, y: 690, size: 14, font });
  page.drawText(title, { x: 72, y: 660, size: 16, font: bold });
  page.drawText("Receiver signature on file (demo sample).", { x: 72, y: 630, size: 12, font });
  page.drawText("For ACCY 628 pitch rehearsal only — not a live carrier scan.", {
    x: 72,
    y: 610,
    size: 11,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawRectangle({
    x: 72,
    y: 480,
    width: 468,
    height: 100,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });
  page.drawText("Signed: ______________________     Date: __________", {
    x: 90,
    y: 520,
    size: 12,
    font,
  });
  const bytes = await doc.save();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), bytes);
  console.log("wrote", file, bytes.length, "bytes");
}

const files = [
  ["signed-bol.pdf", "Sample signed BOL"],
  ["ld-1002.pdf", "Load LD-1002"],
  ["ld-2011.pdf", "Load LD-2011"],
  ["ld-2012.pdf", "Load LD-2012"],
  ["ld-2013.pdf", "Load LD-2013"],
  ["ld-2020.pdf", "Load LD-2020"],
];

for (const [file, title] of files) {
  await make(title, file);
}
