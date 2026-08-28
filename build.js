const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const htmlPath = path.join(ROOT, 'index.html');
const map = [
  "src/app-part1.js",
  "src/app-part2.js",
  "src/app-part3.js",
  "src/app-part4.js",
  "src/app-part5.js",
  "src/app-part6.js",
  "src/app-part7.js",
  "src/app-part8.js",
  "src/app-part9.js",
  "src/app-part10.js",
  "src/app-part11.js",
  "src/app-part12.js"
];

function parseScripts(h) {
  const out = [];
  let idx = 0;
  while (true) {
    const s = h.indexOf('<script', idx);
    if (s < 0) break;
    const endTag = h.indexOf('>', s);
    const openTag = h.slice(s, endTag + 1);
    const close = h.indexOf('</script>', endTag);
    const content = h.slice(endTag + 1, close);
    const isExternal = /\ssrc=/.test(openTag);
    out.push({ s, endTag, close, content, isExternal });
    idx = close + 9;
  }
  return out;
}

const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = parseScripts(html);
const inline = scripts.filter(x => !x.isExternal);
if (inline.length !== map.length) {
  console.error('Expected ' + map.length + ' inline scripts, found ' + inline.length + '. HTML structure changed; update the map in build.js.');
  process.exit(1);
}

// Replace style
let out = html;
const styleStart = out.indexOf('<style>');
const styleEnd = out.indexOf('</style>');
const css = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');
out = out.slice(0, styleStart + 7) + css + out.slice(styleEnd);

// Re-parse after style replace, then 1:1 swap each inline script content
const scripts2 = parseScripts(out);
const inline2 = scripts2.filter(x => !x.isExternal);
const newContent = inline2.map((sc, i) => fs.readFileSync(path.join(ROOT, map[i]), 'utf8'));

let result = '';
let cursor = 0;
inline2.forEach((sc, i) => {
  result += out.slice(cursor, sc.endTag + 1); // opening <script>
  result += newContent[i];
  result += '</script>';
  cursor = sc.close + 9;
});
result += out.slice(cursor);
fs.writeFileSync(htmlPath, result);
console.log('Built index.html (' + result.length + ' bytes) from ' + map.length + ' src files.');
