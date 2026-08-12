const pptx = require("pptxgenjs");
const p = new pptx();
p.defineLayout({ name: "W", width: 13.333, height: 7.5 });
p.layout = "W";

// palette
const NAVY = "0B2E59", DEEP = "071B33", NAVY2 = "123F77";
const ICE = "CADCFC", ACCENT = "2F7BEE", WHITE = "FFFFFF";
const MUTE = "9FB4CE", LINE = "20406B";
const GOOD = "3FBE86", GOODINK = "0F7A4D";
const WARN = "E7A94B", BAD = "E06B6B";
const CARD = "0F294A", CARD2 = "12305A";
const HSER = "Cambria", BODY = "Calibri";

const W = 13.333, H = 7.5, M = 0.7;

function bg(s, c){ s.background = { color: c }; }
function kicker(s, txt, x, y, color){
  s.addText(txt.toUpperCase(), { x, y, w: 8, h: 0.3, fontFace: BODY, fontSize: 11,
    color: color||ACCENT, bold: true, charSpacing: 3, margin: 0 });
}
function pageNum(s, n){
  s.addText(String(n).padStart(2,"0"), { x: W-1.0, y: H-0.5, w: 0.6, h: 0.3,
    fontFace: BODY, fontSize: 9, color: MUTE, align: "right", margin: 0 });
  s.addText("HIDESEC SDK", { x: M, y: H-0.5, w: 3, h: 0.3, fontFace: BODY,
    fontSize: 9, color: MUTE, charSpacing: 2, margin: 0 });
}

/* ---------- 1. TITLE ---------- */
let s = p.addSlide(); bg(s, NAVY);
s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: NAVY } });
// subtle corner block motif
s.addShape(p.ShapeType.rect, { x: W-3.4, y: 0, w: 3.4, h: H, fill: { color: NAVY2 } });
s.addShape(p.ShapeType.rect, { x: W-3.4, y: 0, w: 0.09, h: H, fill: { color: ACCENT } });
s.addText("HIDESEC SDK  ·  MOBILE APPLICATION SECURITY", { x: M, y: 0.85, w: 9, h: 0.4,
  fontFace: BODY, fontSize: 12, color: ICE, bold: true, charSpacing: 3, margin: 0 });
s.addText("Mobile API Protection\nfor Banking", { x: M, y: 2.5, w: 9.2, h: 2.0,
  fontFace: HSER, fontSize: 48, color: WHITE, bold: true, lineSpacing: 50, margin: 0 });
s.addText("Runtime attestation and request-bound signing — delivered as a two-line SDK integration with a bundled server-side verifier.",
  { x: M, y: 4.6, w: 8.3, h: 1.0, fontFace: BODY, fontSize: 17, color: ICE, lineSpacing: 26, margin: 0 });
const tags = ["Runtime Attestation","Request Signing","Gradle + OkHttp","OWASP MASVS","PSD2 · PCI"];
let tx = M;
tags.forEach(t => {
  const w = 0.42 + t.length*0.098;
  s.addShape(p.ShapeType.roundRect, { x: tx, y: 5.85, w, h: 0.42, rectRadius: 0.21,
    fill: { color: NAVY }, line: { color: ICE, width: 0.75 } });
  s.addText(t, { x: tx, y: 5.85, w, h: 0.42, fontFace: BODY, fontSize: 10.5, color: ICE,
    align: "center", valign: "middle", margin: 0 });
  tx += w + 0.18;
});
s.addText("Architecture & Feasibility Brief  ·  v1.0  ·  August 2026", { x: M, y: 6.75, w: 9, h: 0.3,
  fontFace: BODY, fontSize: 11, color: MUTE, margin: 0 });

/* ---------- 2. THE PROBLEM ---------- */
s = p.addSlide(); bg(s, WHITE);
kicker(s, "The problem, precisely stated", M, 0.6);
s.addText("Static analysis exposes the entire API. Hiding cannot fix it.", { x: M, y: 0.95, w: 12, h: 0.7,
  fontFace: HSER, fontSize: 30, color: NAVY, bold: true, margin: 0 });
s.addText("Any banking APK, opened with jadx or apktool, reveals every endpoint, request/response schema, header, and embedded key — even under R8/ProGuard. A rooted-device Frida attacker reads traffic in cleartext before TLS. This is a structural property of the mobile platform, not a bug to patch.",
  { x: M, y: 1.75, w: 12, h: 0.9, fontFace: BODY, fontSize: 15, color: "334155", lineSpacing: 22, margin: 0 });

const exposed = [
  ["Endpoints & paths","URL string constants survive obfuscation"],
  ["Request / response schemas","Retrofit annotations + model field names"],
  ["Embedded API keys","BuildConfig + hardcoded secrets, auto-extractable"],
  ["Live traffic","Frida hooks OkHttp before TLS; pinning stripped in one command"],
];
let ex = M, ew = (12 - 0.5*3)/4;
exposed.forEach((c,i)=>{
  const x = M + i*(ew+0.5);
  s.addShape(p.ShapeType.roundRect, { x, y: 3.0, w: ew, h: 2.3, rectRadius: 0.08,
    fill: { color: "FBEAEA" }, line: { color: "F0C9C9", width: 1 } });
  s.addText("EXPOSED", { x: x+0.25, y: 3.25, w: ew-0.5, h: 0.3, fontFace: BODY, fontSize: 9,
    bold: true, color: "9B1C1C", charSpacing: 2, margin: 0 });
  s.addText(c[0], { x: x+0.25, y: 3.6, w: ew-0.5, h: 0.8, fontFace: BODY, fontSize: 14.5,
    bold: true, color: NAVY, margin: 0, valign: "top" });
  s.addText(c[1], { x: x+0.25, y: 4.4, w: ew-0.5, h: 0.8, fontFace: BODY, fontSize: 11,
    color: "64748B", lineSpacing: 15, margin: 0, valign: "top" });
});
s.addShape(p.ShapeType.roundRect, { x: M, y: 5.75, w: 12, h: 1.05, rectRadius: 0.08, fill: { color: NAVY } });
s.addText([
  { text: "OWASP MASVS-RESILIENCE:  ", options: { bold: true, color: ICE } },
  { text: "“It is impossible to prevent static analysis”, and obfuscation “must never be used as a replacement for security controls.”", options: { color: WHITE, italic: true } },
], { x: M+0.35, y: 5.75, w: 11.3, h: 1.05, fontFace: BODY, fontSize: 14, valign: "middle", lineSpacing: 20, margin: 0 });
pageNum(s, 2);

/* ---------- 3. TWO PROBLEMS ---------- */
s = p.addSlide(); bg(s, WHITE);
kicker(s, "Positioning", M, 0.6);
s.addText("Two problems banks conflate — only one is solvable", { x: M, y: 0.95, w: 12, h: 0.7,
  fontFace: HSER, fontSize: 30, color: NAVY, bold: true, margin: 0 });

// left: not solvable
s.addShape(p.ShapeType.roundRect, { x: M, y: 2.0, w: 5.8, h: 4.6, rectRadius: 0.1,
  fill: { color: "FBEAEA" }, line: { color: "F0C9C9", width: 1.25 } });
s.addText("✕  NOT SOLVABLE CLIENT-SIDE", { x: M+0.4, y: 2.35, w: 5.0, h: 0.4, fontFace: BODY,
  fontSize: 13, bold: true, color: "9B1C1C", charSpacing: 1, margin: 0 });
s.addText("“Hide my endpoints, keys and payloads from an attacker.”", { x: M+0.4, y: 2.85, w: 5.0, h: 0.9,
  fontFace: HSER, fontSize: 18, bold: true, color: NAVY, lineSpacing: 22, margin: 0 });
s.addText([
  { text: "The app must resolve the URL and build or decrypt the payload in its own memory.\n", options: {} },
  { text: "An attacker who controls the device recovers both — statically from the binary, dynamically via Frida. Native / NDK code only buys hours.", options: {} },
], { x: M+0.4, y: 3.95, w: 5.0, h: 2.4, fontFace: BODY, fontSize: 14, color: "334155", lineSpacing: 21, margin: 0, valign: "top" });

// right: solvable
s.addShape(p.ShapeType.roundRect, { x: M+6.2, y: 2.0, w: 5.8, h: 4.6, rectRadius: 0.1,
  fill: { color: "E7F4EE" }, line: { color: "BFE3D0", width: 1.25 } });
s.addText("✓  SOLVABLE — SERVER-ANCHORED", { x: M+6.6, y: 2.35, w: 5.0, h: 0.4, fontFace: BODY,
  fontSize: 13, bold: true, color: GOODINK, charSpacing: 1, margin: 0 });
s.addText("“Make a leaked endpoint or key useless to anything but my genuine app.”", { x: M+6.6, y: 2.85, w: 5.0, h: 0.9,
  fontFace: HSER, fontSize: 18, bold: true, color: NAVY, lineSpacing: 22, margin: 0 });
s.addText([
  { text: "Move the trust anchor to the server.\n", options: {} },
  { text: "Attestation proves a genuine, unmodified app made the request; the signing secret lives server-side; short-lived request-bound credentials mean captured traffic cannot be replayed or forged at scale.", options: {} },
], { x: M+6.6, y: 3.95, w: 5.0, h: 2.4, fontFace: BODY, fontSize: 14, color: "334155", lineSpacing: 21, margin: 0, valign: "top" });

s.addText("The product is built entirely around the right-hand column. Obfuscation is included only as a labeled friction layer — never as the security control.",
  { x: M, y: 6.85, w: 12, h: 0.4, fontFace: BODY, fontSize: 12, italic: true, color: "64748B", margin: 0 });
pageNum(s, 3);

/* ---------- 4. WHAT WE SELL ---------- */
s = p.addSlide(); bg(s, NAVY);
kicker(s, "The pitch that survives due diligence", M, 0.6, ICE);
s.addText("Assume the API is public. Make abuse non-actionable.", { x: M, y: 0.95, w: 12, h: 0.7,
  fontFace: HSER, fontSize: 30, color: WHITE, bold: true, margin: 0 });
s.addText("Bank security reviewers, PCI QSAs and PSD2 auditors evaluate against a threat model that assumes the client is hostile. A vendor promising client-side secrecy fails technical due diligence. Candor is the differentiator.",
  { x: M, y: 1.75, w: 11.5, h: 0.8, fontFace: BODY, fontSize: 15, color: ICE, lineSpacing: 22, margin: 0 });

const stats = [
  ["< 1 ms","added latency per request"],
  ["2 lines","to integrate (plugin + client)"],
  ["Fail-closed","no valid attestation → rejected"],
  ["Bundled","server verifier included"],
];
let sw = (12 - 0.4*3)/4;
stats.forEach((c,i)=>{
  const x = M + i*(sw+0.4);
  s.addShape(p.ShapeType.roundRect, { x, y: 2.95, w: sw, h: 1.55, rectRadius: 0.1, fill: { color: CARD2 }, line: { color: LINE, width: 1 } });
  s.addText(c[0], { x, y: 3.15, w: sw, h: 0.7, fontFace: HSER, fontSize: 26, bold: true, color: WHITE, align: "center", margin: 0 });
  s.addText(c[1], { x: x+0.15, y: 3.9, w: sw-0.3, h: 0.5, fontFace: BODY, fontSize: 11, color: MUTE, align: "center", lineSpacing: 14, margin: 0 });
});

s.addShape(p.ShapeType.roundRect, { x: M, y: 4.8, w: 5.8, h: 1.9, rectRadius: 0.1, fill: { color: "3A1414" }, line: { color: "6B2020", width: 1 } });
s.addText("WHAT WE DELIBERATELY DO NOT SELL", { x: M+0.35, y: 5.05, w: 5.1, h: 0.35, fontFace: BODY, fontSize: 11, bold: true, color: BAD, charSpacing: 1, margin: 0 });
s.addText("“Invisible” or “un-reverse-engineerable” APIs. False on mobile; fails a bank security review on the first call.", { x: M+0.35, y: 5.45, w: 5.1, h: 1.1, fontFace: BODY, fontSize: 14, color: "F1D5D5", lineSpacing: 20, margin: 0, valign: "top" });

s.addShape(p.ShapeType.roundRect, { x: M+6.2, y: 4.8, w: 5.8, h: 1.9, rectRadius: 0.1, fill: { color: "0E3324" }, line: { color: "1C5A3F", width: 1 } });
s.addText("WHAT WE SELL — AND CAN DEFEND", { x: M+6.55, y: 5.05, w: 5.1, h: 0.35, fontFace: BODY, fontSize: 11, bold: true, color: GOOD, charSpacing: 1, margin: 0 });
s.addText("A leaked endpoint or key is useless to anything but your genuine, unmodified app. The same architecture banks already accept under PSD2 and PCI.", { x: M+6.55, y: 5.45, w: 5.1, h: 1.1, fontFace: BODY, fontSize: 14, color: "CBEBD9", lineSpacing: 20, margin: 0, valign: "top" });
pageNum(s, 4);

/* ---------- 5. ARCHITECTURE COMPONENTS ---------- */
s = p.addSlide(); bg(s, WHITE);
kicker(s, "Reference architecture", M, 0.6);
s.addText("Five components — client instrumentation, server enforcement", { x: M, y: 0.95, w: 12, h: 0.7,
  fontFace: HSER, fontSize: 28, color: NAVY, bold: true, margin: 0 });

const comps = [
  ["1","Gradle plugin","Build-time orchestrator on the AGP 8/9 ASM API. Wires codegen + NDK, applies opt-in endpoint obfuscation, and fails the build on hardcoded secrets or cleartext traffic.","friction + hygiene"],
  ["2","KSP codegen","Generates the obfuscated endpoint table and the canonical-request serializer for signing (method + path + body hash + nonce). Zero runtime reflection.","friction"],
  ["3","NDK core","Runs the attestation handshake and requests short-lived JIT secrets after it passes — nothing long-lived is embedded. Uses Keystore / StrongBox where available.","security"],
  ["4","OkHttp interceptor","Developer-facing surface. Attaches the short-lived signed token bound to the request body; dynamic cert pinning; fails closed on critical calls.","security"],
  ["5","Server verifier","The load-bearing control. Verifies signature, freshness, anti-replay and body binding; feeds risk scoring alongside authN/Z and rate limiting.","the control"],
];
const roleColor = { "friction + hygiene": WARN, "friction": WARN, "security": ACCENT, "the control": GOODINK };
let cy = 2.0, chH = 0.86;
comps.forEach((c,i)=>{
  const y = cy + i*(chH+0.1);
  s.addShape(p.ShapeType.roundRect, { x: M, y, w: 12, h: chH, rectRadius: 0.06, fill: { color: i%2? "F4F6F9":"FAFBFC" }, line: { color: "E5E7EB", width: 1 } });
  s.addShape(p.ShapeType.ellipse, { x: M+0.25, y: y+chH/2-0.28, w: 0.56, h: 0.56, fill: { color: NAVY } });
  s.addText(c[0], { x: M+0.25, y: y+chH/2-0.28, w: 0.56, h: 0.56, fontFace: HSER, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0 });
  s.addText(c[1], { x: M+1.05, y: y+0.1, w: 2.5, h: chH-0.2, fontFace: BODY, fontSize: 15, bold: true, color: NAVY, valign: "middle", margin: 0 });
  s.addText(c[2], { x: M+3.65, y: y+0.08, w: 6.55, h: chH-0.16, fontFace: BODY, fontSize: 11.5, color: "334155", valign: "middle", lineSpacing: 14.5, margin: 0 });
  const rc = roleColor[c[3]];
  s.addShape(p.ShapeType.roundRect, { x: M+10.35, y: y+chH/2-0.2, w: 1.5, h: 0.4, rectRadius: 0.2, fill: { color: WHITE }, line: { color: rc, width: 1 } });
  s.addText(c[3].toUpperCase(), { x: M+10.35, y: y+chH/2-0.2, w: 1.5, h: 0.4, fontFace: BODY, fontSize: 8, bold: true, color: rc, align: "center", valign: "middle", charSpacing: 1, margin: 0 });
});
pageNum(s, 5);

/* ---------- 6. LAYERED DEFENSE ---------- */
s = p.addSlide(); bg(s, NAVY);
kicker(s, "Layered defense", M, 0.6, ICE);
s.addText("Four layers, two jobs — never confused", { x: M, y: 0.95, w: 12, h: 0.7,
  fontFace: HSER, fontSize: 30, color: WHITE, bold: true, margin: 0 });

const layers = [
  ["Server enforcement","authN/Z · short-lived revocable tokens · rate limits · anomaly detection","DURABLE CONTROL","1E3A5F","D6E4FB"],
  ["Attestation (server-verified)","Play Integrity / challenge-response → risk scoring · blocks repackaged apps, emulators, bots","SECURITY CONTROL","14432F","CBEBD9"],
  ["Cryptographic (client → server)","per-request signature bound to body + nonce · JIT secrets · dynamic pinning","SECURITY CONTROL","1E3A5F","D6E4FB"],
  ["Obfuscation (client)","endpoint-table + NDK string encryption · deters commodity static analysis","FRICTION ONLY","4A3A17","F2E2C4"],
];
const roleTxt = { "DURABLE CONTROL": ICE, "SECURITY CONTROL": GOOD, "FRICTION ONLY": WARN };
let ly = 2.15, lh = 0.98;
layers.forEach((c,i)=>{
  const y = ly + i*(lh+0.14);
  s.addShape(p.ShapeType.roundRect, { x: M, y, w: 12, h: lh, rectRadius: 0.08, fill: { color: c[3] } });
  s.addText(c[0], { x: M+0.4, y, w: 3.9, h: lh, fontFace: BODY, fontSize: 15.5, bold: true, color: WHITE, valign: "middle", margin: 0 });
  s.addText(c[1], { x: M+4.4, y, w: 5.6, h: lh, fontFace: BODY, fontSize: 12, color: c[4], valign: "middle", lineSpacing: 15, margin: 0 });
  const tc = roleTxt[c[2]];
  s.addShape(p.ShapeType.roundRect, { x: M+10.2, y: y+lh/2-0.22, w: 1.65, h: 0.44, rectRadius: 0.22, fill: { color: c[3] }, line: { color: tc, width: 1 } });
  s.addText(c[2], { x: M+10.2, y: y+lh/2-0.22, w: 1.65, h: 0.44, fontFace: BODY, fontSize: 8, bold: true, color: tc, align: "center", valign: "middle", charSpacing: 0.5, margin: 0 });
});
s.addText("Attacker cost rises from the top down. The bottom layer buys hours; the top three make a recovered API un-usable at scale.",
  { x: M, y: 6.75, w: 12, h: 0.4, fontFace: BODY, fontSize: 12, italic: true, color: MUTE, margin: 0 });
pageNum(s, 6);

/* ---------- 7. DEVELOPER EXPERIENCE ---------- */
s = p.addSlide(); bg(s, WHITE);
kicker(s, "Developer experience", M, 0.6);
s.addText("The entire integration is two lines", { x: M, y: 0.95, w: 12, h: 0.7,
  fontFace: HSER, fontSize: 30, color: NAVY, bold: true, margin: 0 });
s.addText("Attestation handshakes, header injection, pinning, secret substitution and canonicalization are all handled by the SDK. This DX — plus a bundled verifier — is the product’s real differentiator.",
  { x: M, y: 1.75, w: 12, h: 0.7, fontFace: BODY, fontSize: 15, color: "334155", lineSpacing: 22, margin: 0 });

s.addShape(p.ShapeType.roundRect, { x: M, y: 2.7, w: 12, h: 3.9, rectRadius: 0.1, fill: { color: DEEP } });
s.addText([
  { text: "// build.gradle.kts", options: { color: "8B96A8", breakLine: true } },
  { text: "plugins { id(", options: { color: "79C0FF" } },
  { text: "\"io.hidesec.security\"", options: { color: "A5D6FF" } },
  { text: ") version ", options: { color: "79C0FF" } },
  { text: "\"1.x\"", options: { color: "A5D6FF" } },
  { text: " }", options: { color: "79C0FF", breakLine: true } },
  { text: "", options: { breakLine: true } },
  { text: "hidesec {", options: { color: "FFA657", breakLine: true } },
  { text: "    attestationService = ", options: { color: "E6EDF3" } },
  { text: "\"playintegrity\"", options: { color: "A5D6FF", breakLine: true } },
  { text: "    serverVerifierUrl  = ", options: { color: "E6EDF3" } },
  { text: "\"https://api.yourbank.com/attest\"", options: { color: "A5D6FF", breakLine: true } },
  { text: "    failMode           = FailMode.CLOSED", options: { color: "E6EDF3", breakLine: true } },
  { text: "}", options: { color: "FFA657", breakLine: true } },
  { text: "", options: { breakLine: true } },
  { text: "// Runtime — interceptor is pre-wired", options: { color: "8B96A8", breakLine: true } },
  { text: "val", options: { color: "79C0FF" } },
  { text: " client = Hidesec.okHttpClient()", options: { color: "E6EDF3", breakLine: true } },
  { text: "val", options: { color: "79C0FF" } },
  { text: " api = Retrofit.Builder().client(client) … .create(AccountApi::", options: { color: "E6EDF3" } },
  { text: "class", options: { color: "79C0FF" } },
  { text: ".java)", options: { color: "E6EDF3" } },
], { x: M+0.5, y: 3.0, w: 11, h: 3.4, fontFace: "Courier New", fontSize: 12, lineSpacing: 19, valign: "top", margin: 0 });

s.addText("Protected APIs are marked with  @AttestedApi  /  @Encrypted ; KSP generates the signing glue.",
  { x: M, y: 6.8, w: 12, h: 0.35, fontFace: BODY, fontSize: 12, italic: true, color: "64748B", margin: 0 });
pageNum(s, 7);

/* ---------- 8. PERFORMANCE + LIMITATIONS ---------- */
s = p.addSlide(); bg(s, WHITE);
kicker(s, "Performance & honest limits", M, 0.6);
s.addText("Fast on the hot path — candid about the rest", { x: M, y: 0.95, w: 12, h: 0.7,
  fontFace: HSER, fontSize: 30, color: NAVY, bold: true, margin: 0 });

// left: perf
s.addText("LATENCY BUDGET", { x: M, y: 1.95, w: 5.6, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, color: ACCENT, charSpacing: 1, margin: 0 });
const perf = [
  ["Per-request signature (HMAC over body hash)","sub-ms"],
  ["Interceptor overhead","< 1 ms"],
  ["Attestation handshake (amortized at startup)","~200–500 ms, off hot path"],
  ["DEX obfuscation","cold-start cost, opt-in"],
];
let py = 2.35;
perf.forEach((r,i)=>{
  s.addShape(p.ShapeType.roundRect, { x: M, y: py, w: 5.6, h: 0.86, rectRadius: 0.06, fill: { color: i%2?"F4F6F9":"FAFBFC" }, line: { color: "E5E7EB", width: 1 } });
  s.addText(r[0], { x: M+0.25, y: py, w: 3.7, h: 0.86, fontFace: BODY, fontSize: 11.5, color: "334155", valign: "middle", lineSpacing: 14, margin: 0 });
  s.addText(r[1], { x: M+3.95, y: py, w: 1.5, h: 0.86, fontFace: BODY, fontSize: 11, bold: true, color: NAVY, align: "right", valign: "middle", margin: 0 });
  py += 0.94;
});

// right: limits
s.addText("WHAT A FRIDA ATTACKER STILL GETS", { x: M+6.2, y: 1.95, w: 5.8, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, color: BAD, charSpacing: 1, margin: 0 });
const lim = [
  "Reads endpoints & traffic in cleartext — backend never relies on secrecy",
  "Recovers a JIT secret in the moment — but it expires in minutes, revocable",
  "Can script the genuine app — caught by rate limiting & anomaly detection",
  "Can bypass attestation at a cost — it is a weighted signal, not a sole gate",
];
let liy = 2.35;
lim.forEach(t=>{
  s.addShape(p.ShapeType.roundRect, { x: M+6.2, y: liy, w: 5.8, h: 0.86, rectRadius: 0.06, fill: { color: "FBF3F3" }, line: { color: "F0D5D5", width: 1 } });
  s.addText(t, { x: M+6.45, y: liy, w: 5.3, h: 0.86, fontFace: BODY, fontSize: 11.5, color: "334155", valign: "middle", lineSpacing: 14, margin: 0 });
  liy += 0.94;
});

s.addShape(p.ShapeType.roundRect, { x: M, y: 6.2, w: 12, h: 0.8, rectRadius: 0.08, fill: { color: "E7F4EE" }, line: { color: "BFE3D0", width: 1.25 } });
s.addText([
  { text: "The design test:  ", options: { bold: true, color: GOODINK } },
  { text: "if the client SDK vanished, a correctly secured backend would still be safe. Every client layer cuts abuse cost and adds auditable integrity signals on top of that baseline.", options: { color: "285C43" } },
], { x: M+0.4, y: 6.2, w: 11.2, h: 0.8, fontFace: BODY, fontSize: 13, valign: "middle", lineSpacing: 17, margin: 0 });
pageNum(s, 8);

/* ---------- 9. WHY BANKS BUY / COMPLIANCE ---------- */
s = p.addSlide(); bg(s, WHITE);
kicker(s, "Enterprise & banking readiness", M, 0.6);
s.addText("Maps to controls your auditors already verify", { x: M, y: 0.95, w: 12, h: 0.7,
  fontFace: HSER, fontSize: 30, color: NAVY, bold: true, margin: 0 });

const cmap = [
  ["PCI DSS / MPoC / SPoC","Attestation + RASP + key protection map to software-security and tamper-detection; server enforcement covers the auditable controls."],
  ["PSD2 RTS (SCA)","App hardening + attested secure channel supports transaction integrity; SCA remains a server + independent-channel control."],
  ["OWASP MASVS","Positioned as MASVS-RESILIENCE (V8) defense-in-depth on top of the MASVS-L1/L2 baseline — the boundary reviewers look for."],
];
let my = 2.05;
cmap.forEach(c=>{
  s.addShape(p.ShapeType.roundRect, { x: M, y: my, w: 12, h: 1.0, rectRadius: 0.06, fill: { color: "FAFBFC" }, line: { color: "E5E7EB", width: 1 } });
  s.addText(c[0], { x: M+0.35, y: my, w: 3.1, h: 1.0, fontFace: BODY, fontSize: 14.5, bold: true, color: NAVY, valign: "middle", margin: 0 });
  s.addText(c[1], { x: M+3.6, y: my, w: 8.1, h: 1.0, fontFace: BODY, fontSize: 12.5, color: "334155", valign: "middle", lineSpacing: 16, margin: 0 });
  my += 1.12;
});

const why = [
  ["No secret in the binary","Central rotation, no app release"],
  ["Honest threat model","Survives technical due diligence"],
  ["Bundled server verifier","The control ships with the SDK"],
];
let wx = M, ww = (12 - 0.4*2)/3;
why.forEach((c,i)=>{
  const x = M + i*(ww+0.4);
  s.addShape(p.ShapeType.roundRect, { x, y: 5.65, w: ww, h: 1.15, rectRadius: 0.08, fill: { color: NAVY } });
  s.addText(c[0], { x: x+0.3, y: 5.8, w: ww-0.6, h: 0.5, fontFace: BODY, fontSize: 14, bold: true, color: WHITE, margin: 0, valign: "top" });
  s.addText(c[1], { x: x+0.3, y: 6.28, w: ww-0.6, h: 0.45, fontFace: BODY, fontSize: 11, color: ICE, margin: 0, valign: "top" });
});
pageNum(s, 9);

/* ---------- 10. CLOSE ---------- */
s = p.addSlide(); bg(s, NAVY);
s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: NAVY } });
s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: H, fill: { color: ACCENT } });
s.addText("HIDESEC SDK", { x: M, y: 1.2, w: 9, h: 0.4, fontFace: BODY, fontSize: 12, color: ICE, bold: true, charSpacing: 3, margin: 0 });
s.addText("Ship the architecture banks\nalready trust — in two lines.", { x: M, y: 2.4, w: 11, h: 1.8,
  fontFace: HSER, fontSize: 40, bold: true, color: WHITE, lineSpacing: 46, margin: 0 });
s.addText("Attestation-first. Server-verified. Honest about its limits — which is exactly why it passes a banking security review.",
  { x: M, y: 4.4, w: 10.5, h: 0.8, fontFace: BODY, fontSize: 16, color: ICE, lineSpacing: 24, margin: 0 });

const next = [
  ["Reference architecture","Full 7-page technical brief"],
  ["Integration guide","Mobile + backend, staged rollout"],
  ["Pilot scoping","One app, monitor-only, 2 weeks"],
];
let nx = M, nw = (11 - 0.4*2)/3;
next.forEach((c,i)=>{
  const x = M + i*(nw+0.4);
  s.addShape(p.ShapeType.roundRect, { x, y: 5.5, w: nw, h: 1.15, rectRadius: 0.08, fill: { color: CARD2 }, line: { color: LINE, width: 1 } });
  s.addText(c[0], { x: x+0.3, y: 5.65, w: nw-0.6, h: 0.5, fontFace: BODY, fontSize: 13.5, bold: true, color: WHITE, margin: 0, valign: "top" });
  s.addText(c[1], { x: x+0.3, y: 6.12, w: nw-0.6, h: 0.45, fontFace: BODY, fontSize: 10.5, color: MUTE, margin: 0, valign: "top" });
});
s.addText("v1.0 · August 2026", { x: W-3.0, y: 1.25, w: 2.3, h: 0.3, fontFace: BODY, fontSize: 10, color: MUTE, align: "right", margin: 0 });

p.writeFile({ fileName: "/tmp/claude-0/-home-user-hidesec-sdk/9465d762-848c-5a47-88e1-c3b0744a0d85/scratchpad/Hidesec-Sales-Deck.pptx" })
  .then(f => console.log("WROTE", f));
