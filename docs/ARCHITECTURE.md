# Reference Architecture: Attestation-Gated Request-Integrity SDK

> Read [RESEARCH.md](RESEARCH.md) first. The short version: you cannot hide the API from a
> determined attacker on their own device. You *can* make a leaked endpoint/key un-usable by
> anything that is not your genuine, unmodified app. This document designs the SDK around the
> second goal, with obfuscation as an explicitly labeled friction layer — never as the security
> control.

## Design principle: two layers, two jobs, never confused

| Layer | Job | Honest label |
|---|---|---|
| **Cryptographic / attestation** | Server-anchored trust. The signing secret lives on the server; the backend rejects any request without a fresh, valid, request-bound proof of app integrity. | **The security control** |
| **Obfuscation** | Raise the cost of static analysis. Endpoint-table obfuscation, NDK constexpr-XOR strings, control-flow. | **Friction / defense-in-depth** |

If the obfuscation layer ever gets marketed or documented as "secrecy," the product fails a
security review. Keep the boundary explicit in code, docs, and sales.

---

## Components

### (a) Gradle plugin — build-time orchestrator

Built on the **AGP 8.x/9.x ASM Instrumentation API** (`AsmClassVisitorFactory` registered via the
`instrumentation {}` block). The legacy Transform API was removed in AGP 8.0; AGP 9.0.1 shipped
Jan 2026 — anything on Transform is dead.

Responsibilities:
- Register the KSP codegen step and the NDK build.
- Optionally rewrite annotated string literals into obfuscated table lookups (the LSParanoid
  technique) — the friction layer, opt-in per build variant.
- Wire per-variant config: **hardening off in debug** (sane DX), on in release.
- Fail the build on foot-guns: hardcoded secrets in source, `debuggable=true` in release, missing
  pinning config, cleartext traffic permitted.
- Because the SDK ships as an AAR, it must **pre-obfuscate its own strings before publishing** —
  the consumer app's R8 will not encrypt them.

### (b) KSP codegen — compile-time endpoint table + interceptor glue

From a developer's annotated Retrofit interface, generate:
- An obfuscated endpoint descriptor table (keeps endpoints out of grep-able plaintext resources).
- The canonical-request serializer used for signing (SigV4-style canonicalization: method + path +
  sorted query params + body hash + nonce + timestamp).
- Per-endpoint policy tables (which endpoints require attestation, which encrypt bodies).
- JWE envelope wrappers for `@Encrypted` bodies.

Codegen (not reflection) → zero runtime reflection cost, R8-friendly. **Understand this is
friction, not secrecy** — the table is reconstructable at runtime by a hooking attacker.

### (c) NDK core (`libhidesec.so`) — attestation client + secret custody

A small C++/JNI library that:
- Performs the challenge-response attestation handshake (Play Integrity verdict fetch and/or your
  own cloud attestation service).
- Holds **no long-lived signing secret**. It requests **just-in-time runtime secrets** from the
  server *after* attestation passes (the Approov model), so keys are never embedded and are
  centrally rotatable on leak.
- Computes the per-request signature/cryptogram using the server-delivered ephemeral material.
- Uses **Android Keystore / StrongBox** for device-bound keys where available; the hardware
  key-attestation certificate can be sent to the server as an extra signal.
- constexpr-XOR encrypts its own internal strings (friction against static analysis of the `.so`).

**Explicit stance:** this layer is a delay tactic and a custody convenience, not a vault. No secret
here (or anywhere in the app) is safe from a Frida hook in the moment — the value is that JIT
secrets are *short-lived and rotatable*, not that they are unextractable.

### (d) OkHttp interceptor — the runtime integration point (developer-facing surface)

Per request:
- Compute the canonical request hash → pass as Play Integrity `requestHash` (≤500 B) and/or into
  the signed token claims.
- Attach a short-lived signed token / cryptogram (60–300 s TTL, JTI for replay tracking) in an
  `X-App-Attestation` header, **bound** to the request body hash + nonce and to the user's auth
  token (SHA-256 as a claim) — token binding blunts lifting/replay.
- Optionally JWE-encrypt the body (ephemeral AES-256-GCM key wrapped via ECDH-ES with the server
  key) for `@Encrypted` endpoints.
- Enforce certificate pins from a **dynamic** pin set pulled over the attestation channel, so pin
  rotation never needs an app release.
- **Fail closed** on missing/invalid attestation for security-critical calls (document the
  tradeoff — some vendors fail open; failing open nullifies the stack).

On first use / cold start: warm the Play Integrity token provider (rate-limited to 5 prepares/min
per instance) and complete the attestation handshake **asynchronously**, caching the resulting
short-lived credential. Never put the multi-hundred-ms attestation call on the per-request hot path.

### (e) Server-side verifier — the load-bearing component (non-optional)

A drop-in gateway/middleware library (Node/Java/Go) that:
- Verifies the attestation token/cryptogram: signature (server-held key), freshness (short window,
  anti-replay nonce cache), and binding to the request body hash.
- Verifies Play Integrity verdicts server-side (decrypt + check `appIntegrity`, `deviceIntegrity`,
  `requestHash` match) — **never** trust a client-reported verdict.
- Feeds results into **risk scoring**, not only a binary gate, and enforces the durable controls:
  authentication, per-request authorization, short-lived revocable tokens, rate limiting, anomaly
  detection.

> **An attestation SDK without a server verifier is theater.** If the backend fails open, an
> attacker strips the header and the entire client stack is bypassed.

---

## Layered defense model — what each layer defeats

| Layer | Mechanism | Defeats | Does NOT defeat |
|---|---|---|---|
| **Obfuscation (client)** | Endpoint-table obfuscation, NDK constexpr-XOR, control-flow | jadx/apktool/APKLeaks static scans; casual & scripted attackers; "the first hour" | Frida hooking the deobfuscator; dynamic analysis; MITM proxy |
| **Cryptographic (client→server)** | Per-request signature bound to body+nonce, JIT runtime secrets, dynamic pinning | Forged/replayed requests from *outside* a genuine app; leaked-endpoint abuse at scale; passive network MITM | An attacker driving a genuine, attested app instance |
| **Attestation (server-verified)** | Play Integrity / challenge-response verdict → backend risk scoring | Modified/repackaged apps, emulators, bots at scale | Determined attacker on a spoofed keybox / Play Integrity bypass module (raises cost, probabilistic) |
| **Server enforcement** | AuthN/Z, short-lived revocable tokens, rate limits, anomaly detection | Everything the above lets through — the policy backstop | Nothing is bypassed here; this is the durable control |

---

## Developer experience — what the developer writes

```kotlin
// build.gradle.kts
plugins { id("io.hidesec.security") version "1.x" }

hidesec {
    attestationService = "playintegrity"        // or "cloud"
    serverVerifierUrl  = "https://api.example.com/attest"
    obfuscateEndpoints = true                    // friction layer, opt-in
    failMode           = FailMode.CLOSED
}

// Retrofit interface — annotate; codegen does the rest
@AttestedApi
interface AccountApi {
    @POST("v1/transfer")
    suspend fun transfer(@Body req: TransferRequest): TransferResponse
}

// Runtime — one call; interceptor is pre-wired
val client = Hidesec.okHttpClient()
val api = Retrofit.Builder().client(client)/* ... */.create(AccountApi::class.java)
```

The developer never touches attestation handshakes, header injection, pinning, secret
substitution, or canonicalization. **That DX is the only defensible reason to ship an SDK** instead
of telling teams to wire DexGuard + Approov + Play Integrity themselves.

---

## Performance budget

| Cost | Budget | How to hit it |
|---|---|---|
| Attestation handshake | ~200–500 ms (Play Integrity standard, warm); seconds (classic) | **Amortize:** fetch per session at startup/async, cache the short-lived token, refresh in background. Never on the per-request path. |
| Per-request signature (software HMAC over body hash) | sub-millisecond | Keep the signing key software or TEE, not StrongBox, on the hot path |
| Per-request signature (StrongBox key) | tens–>100 ms | Avoid per-request StrongBox signing; only ~9% of premium devices have it anyway |
| Body-inclusive signature | ∝ payload size (buffering required) | Sign headers + streaming body hash where possible; don't buffer large uploads |
| Interceptor overhead (header compute + optional secret substitution) | < 1 ms | — |
| Obfuscation (DEX) | measurable cold-start increase | **Disclose it.** Make the friction layer opt-in per variant (cf. Appdome's "Favor Loading Time" toggle) |
| Binary size | small `.so` per ABI | — |

---

## Honest limitations — what a Frida attacker still gets

Regardless of anything in this SDK, a determined attacker on a rooted device with Frida/objection:

- **Sees every endpoint, header, request, and response in cleartext** by hooking the OkHttp Java
  layer before TLS, or by stripping pinning and running a MITM proxy. Endpoint obfuscation and
  dynamic pinning buy time, not secrecy.
- **Recovers any decrypted secret** by hooking the NDK decrypt routine or `Cipher.doFinal()`. JIT
  runtime secrets are better than hardcoded ones *only because they are short-lived and rotatable*.
- **Drives a genuine, attested app instance** to mint valid tokens and reuse them — attestation
  proves "a real app made this request," not "a legitimate user made a legitimate request." Body
  binding limits blind replay, not scripting of the real app (the hostile-client problem).
- **Bypasses attestation itself** at a cost — keybox spoofing, Play Integrity bypass modules,
  hooking the verdict path. This is probabilistic cost-raising, not a guarantee.

**Therefore the server-side verifier is load-bearing and every client layer is instrumentation
feeding it.** The test of an honest design: *if the client SDK vanished, a correctly secured
backend would still be safe.* Assume the API is public; authenticate and authorize every request;
issue short-lived (15–60 min) revocable tokens; rate-limit and anomaly-detect; keep real secrets
off the client entirely (BFF / "dumb client"); treat attestation as one weighted signal, never a
sole gate.

---

## Enterprise readiness checklist

**Key & secret management**
- No long-lived signing key in the binary — server-held, delivered JIT post-attestation.
- Central key rotation without an app release; short token/cryptogram validity windows; revocation
  on leak detection.
- Per-request nonce + server-side anti-replay cache.
- Any material the NDK holds is constexpr-encrypted and documented as friction only.

**CI/CD**
- Gradle plugin runs headless; per-variant config (hardening off in debug, on in release).
- Obfuscation seeds pinned per release so crash symbols de-obfuscate.
- R8 + obfuscation mapping files archived and uploaded to crash reporting (Crashlytics/Sentry) —
  de-obfuscated stack traces are a hard operational requirement.
- Attestation-service credentials in the CI secrets manager, never in source.

**Supply chain**
- Sign published artifacts (Sigstore / Maven signing); publish an SBOM.
- Pin transitive deps and audit that they are maintained — the archived klaxit plugin is the
  cautionary tale.
- Reproducible NDK toolchain; verify the `.so` you ship is the `.so` you built.

**Availability / compatibility (design a degraded mode)**
- Play Integrity requires Google Play Services — non-GMS (Huawei, China, custom ROMs), sideloaded
  builds, CI emulators, and offline scenarios fail attestation. Define an explicit degraded tier.
- Default **10,000 requests/day** Play Integrity quota — plan warm-up caching and request a quota
  increase before a wide rollout, or you ship a production outage.
- Cold start pays the attestation + provisioning cost; add a warm-up call. Signed requests need
  server-side clock-skew tolerance and retry-on-401 re-provisioning.

**Compliance**
- **PCI DSS / PCI MPoC / SPoC** (payments): attestation + RASP + key protection map to
  software-security and tamper-detection requirements; server-side enforcement covers the auditable
  controls. Obfuscation alone satisfies nothing.
- **PSD2 RTS (SCA)** (EU banking): app hardening + attested secure channel is the established
  pattern; document that attestation supports transaction integrity — but SCA itself is a server +
  independent-channel control.
- **OWASP MASVS**: position the SDK against MASVS-RESILIENCE (V8) explicitly as *optional
  defense-in-depth on top of* the MASVS-L1/L2 baseline — mirror OWASP's own language so reviewers
  see the boundary is understood.

**Product-honesty guardrails (themselves a compliance angle)**
- Ship the security-strength warnings the OSS tools omit: obfuscation is friction, attestation is
  probabilistic, the backend is the control.
- Provide the server verifier and reference backend policies as first-class deliverables. An
  attestation SDK without server enforcement is theater, and enterprise reviewers know it.

---

## Buy-vs-build summary

| Situation | Recommendation |
|---|---|
| Regulated enterprise that needs the outcome now | **Buy Approov** (reference architecture, cross-platform, secrets-off-device) or wire **Play Integrity + App Attest** yourself if you have backend capacity |
| Need certified code hardening for a compliance checkbox | **Buy DexGuard** (or Appdome/Promon/Verimatrix) — but only *on top of* server-side security |
| Startup / mid-market, want a visible price and free tier | **Talsec** freeRASP → RASP+ / AppiCrypt |
| Baseline hygiene (every app) | R8 + resource shrinking + `-obfuscationdictionary` + LSParanoid string obfuscation + OkHttp CertificatePinner — with zero expectation of API secrecy |
| Building the SDK | The genuine gap is **DX**: no OSS product packages endpoint obfuscation + build-time hardening + OkHttp middleware + attestation + a server verifier into one drop-in. Fill *that* — an attestation-first SDK that makes the correct architecture a Gradle plugin + one interceptor + a drop-in verifier — not another obfuscator. |
