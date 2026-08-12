# Research Report: Protecting the Android REST API Surface from Static Analysis

**Date:** 2026-08
**Question:** Static analysis of an Android APK easily exposes all REST endpoints, requests,
responses, and often API keys — even under R8/ProGuard obfuscation. Can an SDK (build-time Gradle
plugin and/or OkHttp middleware, possibly NDK-backed) resolve this with good developer experience,
strong security, negligible performance cost, and enterprise production readiness?

This report was produced by a multi-agent research workflow (four parallel investigators covering
the threat model, the commercial landscape, the OSS/build-time landscape, and runtime architectures),
followed by an adversarial verification pass on the three load-bearing claims. Sources are primary
where possible (vendor docs, OWASP MAS, GitHub repos, engineering blogs).

---

## 1. The premise is correct — and the reason is structural

R8/ProGuard **rename** JVM symbols (classes, methods, fields). They do **not** encrypt string
literals, and they cannot remove the network contract, because the app needs the URL and the
wire-format field names at runtime to make the request. Consequently, from a release APK an
analyst recovers, in seconds:

- Base URLs and endpoint paths (string constants)
- Retrofit `@GET`/`@POST`/`@Path`/`@Query` annotations — Retrofit's own consumer keep-rules
  preserve these
- Request/response model field names (Gson/Moshi/kotlinx.serialization) and Kotlin `@Metadata`
- `BuildConfig` constants and hardcoded API keys
- Header names and auth scheme

Tools that automate this: **jadx**, **apktool**, **APKLeaks** (regex-mines endpoints/secrets),
`strings`. Hardcoded secrets are considered trivially and automatically extractable —
OWASP M1 (Improper Credential Usage) treats any embedded secret as compromised by definition.

> **Key fact:** R8 has *no* string-encryption feature and Google has stated it is out of scope.
> Any "hide my strings" capability comes from commercial tooling (DexGuard) or a custom/OSS
> bytecode transform — never from R8 itself.

**Sources:** guardsquare.com/blog/android-security-and-obfuscation-realities-of-r8 ·
mas.owasp.org/MASVS/11-MASVS-RESILIENCE · appsecsanta.com/apkleaks ·
danaepp.com/discovering-api-secrets-endpoints-using-apkleaks ·
dev.to/jocanola OWASP-M1-2024 writeup

---

## 2. Why "make it native C++" does not solve it

Moving endpoints/keys into an NDK `.so` is a widely marketed technique (klaxit plugin, countless
Medium posts). It **raises reverse-engineering cost** but does **not** make anything secret:

- Native libraries are disassembled (Ghidra/IDA); XOR/constexpr-encrypted strings are recovered
  by emulation or by reading them post-decryption.
- More decisively, **dynamic analysis defeats the whole category**: an attacker on their own
  rooted device uses Frida/objection to (a) hook your native decrypt routine and read the
  plaintext it returns, or (b) hook the OkHttp/Java HTTP layer *before* TLS and read every
  endpoint, request, and response in cleartext, or (c) strip certificate pinning in one command
  and run a MITM proxy (mitmproxy/Burp).
- Approov publicly demonstrated exactly this by MITM-ing the (obfuscated) ChatGPT mobile app and
  extracting its secrets.

The canonical OSS NDK secret-hider, **klaxit/hidden-secrets-gradle-plugin**, was **archived on
2025-12-24** and is no longer maintained — its own authors acknowledge client-side hiding is
fundamentally breakable. Do not adopt it.

**Sources:** github.com/klaxit/hidden-secrets-gradle-plugin ·
approov.io/blog/how-to-use-a-mitm-attack-to-bypass-code-obfuscation-to-extract-secrets-from-the-chatgpt-mobile-app ·
redfoxsec.com/blog/ssl-pinning-bypass-for-android-using-frida ·
blog.nviso.eu/2019/04/02/circumventing-ssl-pinning-in-obfuscated-apps-with-okhttp

---

## 3. What OWASP actually says

OWASP **MASVS-RESILIENCE (V8 / MASVS-R)** is explicit and worth quoting because it settles the
framing:

- Resilience controls (obfuscation, string/asset encryption, native/NDK storage, anti-tamper,
  RASP, root/emulator detection) are **optional defense-in-depth** that **must never replace**
  security controls.
- "It is **impossible to prevent static analysis**."
- "The absence of resilience measures such as obfuscation does not in itself constitute a
  vulnerability."
- All apps must independently satisfy the real security controls (MASVS-L1/L2) per their threat
  model, regardless of resilience hardening.

So the correct product framing is: obfuscation is **friction** measured against MASVS-R; the
security control is **server-verified attestation + backend enforcement** measured against
MASVS-L1/L2. Mirroring this language is also what makes the product credible to enterprise
security reviewers.

**Sources:** mas.owasp.org/MASVS/11-MASVS-RESILIENCE · mas.owasp.org/MASTG/0x04c-Tampering-and-Reverse-Engineering ·
help.guardsquare.com OWASP-MASVS-RESILIENCE

---

## 4. The two problems buyers conflate

| Claim | Solvable? | Why |
|---|---|---|
| "Hide my endpoints / secrets / payloads from an attacker" | **No** (client-side) | The client must resolve the URL and build/decrypt the payload in its own memory; an attacker who controls the runtime recovers both. Static analysis gets the binary contents; dynamic analysis gets everything else. |
| "Make a leaked endpoint/key useless to anything but my genuine app" | **Partially** | Move the trust anchor server-side: attestation proves "a genuine, unmodified app instance made this request," the signing secret lives on the server, and the backend rejects anything without a fresh, valid, request-bound proof. |

The second is the real, buildable product. It does not make the API secret — it makes API
knowledge **non-actionable at scale**.

---

## 5. Commercial landscape (2025–2026)

Two architectural camps solve two different problems.

### Camp A — "make static analysis expensive" (code hardening / RASP)

| Product | Technique for hiding endpoints/secrets | DX | Notes |
|---|---|---|---|
| **Guardsquare DexGuard** | String encryption, class/DEX encryption, API-call hiding (direct calls → encrypted reflection), control-flow obfuscation, code virtualization, RASP | Gradle plugin (`com.guardsquare:dexguard-gradle-plugin`) + ProGuard-syntax config — exactly the build-time model in question | Gold standard; ~$44K/yr; **friction, not secrecy** |
| **Appdome** | No-code cloud "fusion" — machine injection of 400+ protections into the compiled AAB/APK in CI/CD | No SDK, no source changes | Ships a "Favor Loading Time" toggle — a tacit admission that heavy obfuscation costs cold-start time |
| **Promon SHIELD** | Post-compile binary injection for RASP; separate Promon Data Protect for secret/data encryption | "Minutes, no code changes" | RASP-first |
| **Digital.ai (ex-Arxan)** | White-box cryptography — keys blended into code so they never exist in extractable form during execution | Build integration | WBC is repeatedly broken academically (see §8) |
| **Verimatrix XTD** | Classic shielding (obfuscation, anti-tamper, env checks, WBC) + XDR monitoring layer | Build + telemetry | Adds detection/response |

### Camp B — "make a leaked API un-callable by non-genuine apps" (attestation)

| Product | Technique | DX | Notes |
|---|---|---|---|
| **Google Play Integrity API** | Verdicts: appIntegrity, deviceIntegrity (hardware-backed), accountDetails; `requestHash` binds token to a request | Google API + backend verdict verification | **Free baseline** (default 10K checks/day); Android + GMS only; the gaps are what paid vendors monetize |
| **Approov** | Challenge-response cloud attestation → short-lived signed JWT; **just-in-time runtime secret delivery** (keys never in the binary, centrally rotatable); dynamic cert pinning; token binding | **OkHttp interceptor** (`approov-service-okhttp`) + Retrofit quickstarts — precisely the SDK shape proposed | Billed per MAU; the reference implementation of the correct architecture |
| **Talsec freeRASP / RASP+ / AppiCrypt** | RASP threat detection; AppiCrypt = per-request cryptogram verified at the gateway, no Google dependency | SDK | **Only vendor with transparent pricing** — freeRASP free to ~100K downloads; RASP+ €284–648/mo |
| **Build38 T.A.K** | Client hardening + attested secure channel; File Protector ships keys only in encrypted form | SDK | Being acquired by OneSpan (announced Jan 2026) |
| **Apple App Attest / DeviceCheck** | iOS hardware attestation | Apple API | Always pair with Play Integrity for cross-platform parity |

**Bottom line:** Camp A does **not** durably solve "static analysis reveals my API" (dynamic
analysis sidesteps it). Camp B is what actually protects the API. A serious product needs a Camp B
core with Camp A as an optional friction layer.

**Sources:** guardsquare.com/dexguard · vendr.com/buyer-guides/guardsquare-nv ·
appdome.com/how-to/mobile-app-security/mobile-code-obfuscation/favor-loading-time ·
approov.io/knowledge/how-does-approov-work · github.com/approov/approov-service-okhttp ·
docs.talsec.app/freerasp/features-and-pricing-plans · developer.android.com/google/play/integrity/overview ·
promon.io/products/shield-mobile · digital.ai/products/application-security/key-data-protection ·
build38.com/platform/mobile-in-app-protection

---

## 6. OSS / build-time landscape

| Tool | Status (2026) | Value / limit |
|---|---|---|
| **klaxit/hidden-secrets-gradle-plugin** | **Archived 2025-12-24** | Canonical NDK secret-hider, now dead. Do not adopt. |
| **MichaelRocks/paranoid** | Effectively dead | Built on the AGP **Transform API, removed in AGP 8.0** — incompatible with modern builds |
| **LSPosed/LSParanoid** (`org.lsposed.lsparanoid`) | Active, AGP 8+ | The realistic OSS choice for endpoint-string obfuscation. Replaces literals with `Deobfuscator.getString(index)` — but that deobfuscator is callable by an attacker; ships no security warnings |
| **dProtect** (open-obfuscator) | Unmaintained | Closest OSS DexGuard alternative (string/control-flow/arithmetic obfuscation on ProGuardCORE); string obfuscation publicly recovered via Katalina/JEB emulation |
| **NDK constexpr XOR** (adamyaxley/Obfuscate, xorstr) | Active header-only libs | Compile-time string encryption so plaintext never hits the binary; defeats `strings`/grep/casual jadx, not a debugger |
| **ASM Instrumentation API** (`AsmClassVisitorFactory` via `instrumentation {}`) | **The mandatory modern path** | Any bytecode-rewriting SDK on AGP 8.x/9.x must use this; the Transform API is gone. AGP 9.0.1 shipped Jan 2026 |

**No existing OSS product** packages "endpoint-table hiding + build-time obfuscation + OkHttp
middleware + attestation" into one SDK. GitHub/Maven searches surface only generic payload-
encryption interceptor demos. That gap is the opening — but it partly exists *because* the
client-only version has limited security value.

**Every** build-time OSS technique here is defeated by the same runtime attack: Frida hooking the
deobfuscation/decrypt function, or hooking the OkHttp/Java layer before TLS.

**Sources:** github.com/LSPosed/LSParanoid · github.com/open-obfuscator/dProtect ·
github.com/adamyaxley/Obfuscate · developer.android.com/build/releases/gradle-plugin-api-updates ·
proandroiddev.com/bytecode-transformations-the-android-gradle-plugin-def2be393bca

---

## 7. Runtime architectures that actually protect APIs

- **Attestation-gated request signing (Approov pattern)** — the strongest client-integrity
  architecture. A hardened SDK gets a short-lived cloud-signed token *only if* the app+runtime
  pass attestation; the backend verifies the token. The signing secret never ships in the app.
- **Token binding** — the attestation token is cryptographically bound (SHA-256 of a value, e.g.
  the user's auth token) so a lifted token can't be replayed from elsewhere. This blunts, but does
  not eliminate, token-lifting.
- **Play Integrity `requestHash`** — standard requests bind the verdict to a specific request
  (SHA-256 of request params, ≤500 bytes) returned verbatim in the encrypted verdict. Gives
  per-request integrity **if** attestation is invoked per request (cost/quota tradeoff).
- **Certificate pinning** — OkHttp `CertificatePinner` stops passive/opportunistic network MITM
  and is worth shipping; it is **not** an anti-RE control (objection bypasses it in minutes on a
  rooted device). **Dynamic pinning** (OTA-updatable pin set) fixes the biggest operational pain
  of static pinning: pin rotation without an app release.
- **Application-layer payload encryption** (encrypting bodies inside TLS as JWE, hybrid RSA+AES or
  ECDH-ES) — real standardized enterprise practice (Google Pay banking APIs, Mastercard Open
  Banking). Against the *specific* threat here — an attacker who owns the device and cooperates in
  the MITM — it degrades to obfuscation, because the app decrypts in its own memory where Frida
  hooks it. Value is against network/passive adversaries, not the device owner.
- **White-box cryptography** — considered **broken** as a guarantee: Differential Computation
  Analysis (DCA, CHES 2016) and DFA recover keys from a handful of execution/memory traces without
  reverse-engineering the WBC. Raises cost; not a secret-keeping guarantee.
- **AWS SigV4-style HMAC signing** — gives request integrity + replay protection, but for a mobile
  app it moves the problem to key placement: a long-lived signing key in the app is extractable.
  Only meaningful when the key is delivered JIT post-attestation and is short-lived.
- **Endpoint indirection / gRPC-protobuf** — only *incidental* obfuscation. Protobuf descriptors
  are recoverable from the client or server binary (pbtk-style). Not protection.
- **GraphQL persisted-query allowlisting** — a legitimate attack-surface-reduction control
  (register trusted operations, accept only operation hashes, reject arbitrary queries). GA at
  Apollo. Authenticates *what* can run, not *who* runs it — complementary to attestation.

**Sources:** approov.io/mobile-app-security/rasp/app-attestation ·
developer.android.com/google/play/integrity/standard · iacr.org/archive/ches2016/98130106/98130106.pdf ·
developers.google.com/pay/banking-fop-v2/guides/connectivity/security/application-layer ·
apollographql.com/docs/graphos/routing/security/persisted-queries ·
labs.ioactive.com/2021/07/breaking-protocol-buffers-reverse.html

---

## 8. Adversarial verification of the load-bearing claims

Each claim below was handed to an independent reviewer instructed to **refute** it. None were
refuted; the surviving caveats are what make the recommendation honest.

### Claim 1 — "Pure client-side hiding only raises attacker cost; a Frida/MITM-on-own-device attacker always recovers endpoints and payloads. It cannot be a sole security control."
**Not refuted.** Matches OWASP MASVS-R and the dynamic-analysis mechanics exactly.
Caveats: (a) the word "always" is too absolute for the *live-transaction* case — a strictly
enforced hardware-backed attestation stack can, in practice, stop a tampered/rooted client from
completing a session; but that is a server-side environment control, not client-side hiding, and it
still does not hide the endpoint from static analysis. (b) Distinguish *recovering* an endpoint
(essentially always possible) from *successfully using* it (stoppable server-side). Client-side
hiding failing ≠ API exploitable — the real defense is server-side.

### Claim 2 — "The load-bearing control for 'only my genuine app can call my API' is remote attestation with server-side verification, not client-side secrecy."
**Not refuted** directionally, but the strong framing overstates what attestation delivers.
Caveats: (a) attestation is itself bypassable (device-profile spoofing, unrevoked keybox
replacement, live-token relay, Frida/Magisk/Zygisk hooking) — it is probabilistic risk reduction,
not proof. (b) "Only my genuine app" is fundamentally unachievable: a legitimate user can script
the real app or relay attested requests (the hostile-client problem). (c) Play Integrity's
operational limits (10K/day default quota, Android+GMS only, no iOS) undercut "load-bearing at
scale" without engineering around them. (d) It is one layer of defense-in-depth — it does not
replace authN/Z, rate limiting, bot/anomaly detection, WAF. (e) Source bias: much supporting
material is from attestation vendors (Approov, Guardsquare) with an interest in positioning
Play Integrity as insufficient.

### Claim 3 — "A hybrid SDK (build-time endpoint obfuscation + OkHttp interceptor doing attestation-gated request signing) is feasible with negligible (< a few ms) per-request overhead and good DX on modern AGP."
**Not refuted** in its narrow technical form, but true only under an architecture it doesn't state:
- Attestation **must** be amortized off the hot path. A Play Integrity *standard* request costs
  ~200–500 ms even warm (classic: seconds). Putting attestation on the request path falsifies the
  latency claim; strict per-request gating also collides with the 10K/day quota. → Fetch/refresh
  tokens asynchronously, cache the gated credential, accept a wider replay window.
- Key placement dominates signing latency: software HMAC-SHA256 is microseconds; TEE Keystore
  signing is single-digit-to-tens of ms; **StrongBox** signing can exceed the whole "few ms" budget
  and only ~9% of premium devices have it.
- Body-inclusive signatures require buffering the `RequestBody` to hash it — breaks/bloats
  streaming/duplex bodies and scales with payload size. Large uploads are not "a few ms."
- "Good DX on modern AGP" is the weakest leg: R8 has no string encryption, the AGP-8 Transform
  removal forces a custom ASM Instrumentation-API plugin, and an SDK shipped as an AAR must
  **pre-obfuscate itself** (the consumer's R8 won't encrypt your strings). Feasible, but "good DX"
  depends on maintaining bespoke build tooling across AGP churn.
- Feasibility ≠ efficacy: decrypted-in-memory strings and a hookable signing interceptor mean the
  scheme deters only casual reverse engineering.

**Sources:** developer.android.com/google/play/integrity/{overview,standard,setup} ·
support.google.com/googleplay/android-developer/answer/15299193 ·
android-developers.googleblog.com AGP8 migration · guardsquare.com/blog/google-play-integrity-api-app-attestation ·
approov.io/blog/limitations-of-google-play-integrity-api-ex-safetynet

---

## 9. Conclusion

An SDK **cannot** make endpoints, keys, or traffic secret from a motivated attacker on their own
device — no build-time transform, NDK core, or payload encryption changes that. What it **can** do
is (1) raise the static-analysis bar to deter casual/scripted attackers, (2) protect on-device
at-rest data, and (3) — the actual product — gate the API on **server-verified runtime attestation
and short-lived, request-bound signed credentials**, so that recovered API knowledge is not
usable by anything other than a genuine app instance.

Build the SDK as **attestation-first with obfuscation as a labeled friction layer**, ship a
**mandatory server-side verifier**, and market it honestly against OWASP MASVS. The detailed design
is in [ARCHITECTURE.md](ARCHITECTURE.md).
