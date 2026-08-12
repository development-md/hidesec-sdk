# Hidesec SDK — Integration Guide for Mobile & Backend Teams

**Audience:** Android mobile engineers and API/backend engineers integrating Hidesec into a
banking app. **Prerequisite reading:** [ARCHITECTURE.md](ARCHITECTURE.md) and
[RESEARCH.md](RESEARCH.md) for the threat model. This guide is the *how*; those are the *why*.

> **The one rule that governs everything below:** the client SDK produces signals; the
> **server-side verifier enforces them**. If you deploy the SDK but not the verifier, you have
> added latency and no security. Integrate both, or neither.

---

## 0. Integration at a glance

| Stage | Owner | Effort | Outcome |
|---|---|---|---|
| 1. Add Gradle plugin | Mobile | ~30 min | Build-time hardening + codegen wired |
| 2. Annotate APIs & swap the client | Mobile | ~1 hr | Attestation + signing on protected calls |
| 3. Deploy the verifier middleware | Backend | ~1 day | Requests without valid attestation rejected |
| 4. Configure attestation provider | Backend + Play Console | ~1 day | Play Integrity project linked, keys provisioned |
| 5. Define policy & degraded mode | Both | ~1 day | Fail-closed critical calls; graceful non-GMS handling |
| 6. Rollout & monitoring | Both | staged | Risk scoring live; dashboards; kill-switch |

Plan a **staged rollout** (monitor-only → enforce). Never ship straight to fail-closed in
production — you will lock out a long tail of legitimate non-GMS / offline / clock-skewed devices
until the degraded mode is tuned.

---

## 1. Mobile: add the Gradle plugin

```kotlin
// settings.gradle.kts — plugin repository
pluginManagement { repositories { gradlePluginPortal(); mavenCentral() } }

// app/build.gradle.kts
plugins {
    id("com.android.application")
    id("com.google.devtools.ksp") version "<ksp-version>"
    id("io.hidesec.security") version "1.x"
}

hidesec {
    attestationService = "playintegrity"          // "playintegrity" | "cloud"
    serverVerifierUrl  = "https://api.yourbank.com/attest"
    obfuscateEndpoints = true                       // friction layer; opt-in per variant
    failMode           = FailMode.CLOSED            // CLOSED for banking

    // Per-variant overrides keep DX sane
    variants {
        named("debug")   { obfuscateEndpoints = false; failMode = FailMode.MONITOR }
        named("release") { /* inherits the strict defaults */ }
    }
}
```

**Requirements:** AGP 8.x/9.x (the plugin uses the ASM Instrumentation API — the removed Transform
API is not supported), NDK for the native core, `minSdk` 24+ recommended.

**What the plugin does at build time:**
- Registers KSP codegen and the NDK build.
- Applies opt-in endpoint-string obfuscation to annotated constants.
- **Fails the build** if it detects: hardcoded secrets in source, `debuggable=true` in a release
  variant, missing/weak network-security-config, or cleartext traffic permitted. Treat these as
  hard gates, not warnings.

> **AAR note:** the SDK's own strings are pre-obfuscated at publish time. Your app's R8 will not
> encrypt them — do not rely on consumer R8 for the friction layer.

---

## 2. Mobile: annotate APIs and swap the client

```kotlin
// Mark the interfaces (or individual methods) that require attestation.
@AttestedApi
interface AccountApi {

    @POST("v1/transfer")
    suspend fun transfer(@Body req: TransferRequest): TransferResponse   // critical → fail-closed

    @Encrypted                                                            // JWE body encryption
    @POST("v1/beneficiary")
    suspend fun addBeneficiary(@Body req: BeneficiaryRequest): Ack

    @AttestationRequired(tier = Tier.STRONG)                             // require hardware-backed verdict
    @GET("v1/statements/{id}")
    suspend fun statement(@Path("id") id: String): Statement
}
```

```kotlin
// Build the client once (DI singleton). The interceptor is pre-wired.
val client: OkHttpClient = Hidesec.okHttpClient {
    // Optional tuning
    attestationWarmupOnStart = true          // pay the ~200-500ms cost at launch, off the hot path
    tokenTtlSeconds          = 120
    degradedMode             = DegradedMode.LIMITED   // see §5
}

val api = Retrofit.Builder()
    .baseUrl("https://api.yourbank.com/")
    .client(client)
    .addConverterFactory(/* your converter */)
    .build()
    .create(AccountApi::class.java)
```

**What the interceptor adds per request** (all generated / handled for you):
- `X-App-Attestation`: a short-lived signed token bound to the **canonical request hash**
  (method + path + sorted query + body SHA-256 + nonce + timestamp) and to the user session.
- Dynamic certificate pins (rotated OTA via the attestation channel — no app release to rotate).
- Optional JWE body encryption for `@Encrypted` endpoints.

**Do not** put attestation on the per-request path. Warm it at startup and on token expiry; the
interceptor caches the short-lived token and refreshes in the background.

---

## 3. Backend: deploy the server-side verifier (the load-bearing control)

The verifier ships as middleware for Node/Java/Go. Node example:

```js
import { hidesecVerifier } from "@hidesec/verifier";

app.use("/v1", hidesecVerifier({
  attestation: "playintegrity",
  playIntegrity: {
    packageName: "com.yourbank.app",
    cloudProjectNumber: process.env.PLAY_CLOUD_PROJECT,   // from Google Cloud
    decryptionKey: process.env.PLAY_DECRYPTION_KEY,        // verify verdicts SERVER-SIDE
  },
  policy: {
    // Bind the token to the request and reject stale/replayed proofs
    verifyBodyHash: true,
    nonceWindowSeconds: 120,
    clockSkewSeconds: 60,
    // Feed a score instead of a hard boolean where you want nuance
    onVerdict: (ctx) => riskEngine.score(ctx),   // ctx: appIntegrity, deviceIntegrity, account, requestHash…
  },
  failMode: "closed",   // reject when attestation is missing/invalid on protected routes
}));
```

**Non-negotiables for a banking backend:**
1. **Verify verdicts server-side.** Never trust a client-reported attestation result. Decrypt and
   validate the Play Integrity token (or your cloud attestation JWT) on the server.
2. **Check the binding.** The token's `requestHash` / body-hash claim must match the request you
   received. This is what stops a lifted token from being reused on a different request.
3. **Enforce freshness + anti-replay.** Short window + a server-side nonce cache (Redis). Reject
   reused nonces.
4. **Fail closed on protected routes.** For transfers, beneficiary changes, statements — reject,
   don't warn.
5. **This sits on top of, not instead of, your existing controls:** authenticate and authorize
   every request, issue short-lived revocable session tokens, rate-limit, and run anomaly
   detection. Attestation is one weighted signal into risk scoring.

---

## 4. Configure the attestation provider (Play Integrity)

1. Enable the **Play Integrity API** in a linked **Google Cloud project**; note the project number.
2. In **Play Console → App integrity**, link the project and configure response encryption
   (Google-managed or your own key). Provision the decryption key to the verifier's secret store.
3. Request a **quota increase** — the default is **10,000 requests/day**, which a production bank
   app will exceed. Do this *before* rollout, not after the outage.
4. For iOS parity, configure **Apple App Attest / DeviceCheck** and point the verifier at the
   matching policy (out of scope for this Android guide, but plan for it).

**Cloud attestation (`attestationService = "cloud"`)** is the alternative when you cannot depend on
Google Play Services (see §5) — a challenge-response handshake against the Hidesec attestation
service that returns a signed token, no GMS dependency.

---

## 5. The degraded mode (do not skip this)

Play Integrity requires Google Play Services and Play-track distribution. These populations will
**fail** hardware attestation through no fault of the user:

- Non-GMS devices (Huawei, some China-market, de-Googled ROMs)
- Sideloaded / enterprise-distributed builds
- CI emulators, offline / airplane-mode, severe clock skew
- First launch before the token provider has warmed

Define an explicit policy per route class:

| Route class | GMS device | Non-GMS / degraded |
|---|---|---|
| Read-only, low-risk (e.g. FX rates) | attested | allow with lower trust score |
| Account read (balances, statements) | attested | allow + step-up (re-auth / OTP) |
| Money movement (transfer, beneficiary) | attested, fail-closed | **cloud attestation fallback**, or block + guide user |

`DegradedMode.LIMITED` (recommended default) lets low-risk calls through with a reduced risk score
and forces step-up or blocks on high-risk calls. `DegradedMode.BLOCK` is stricter but will generate
support tickets — measure your non-GMS population first.

---

## 6. Rollout, monitoring, and operations

**Staged rollout**
1. **Monitor-only** (`failMode = MONITOR`): SDK attaches tokens; verifier logs verdicts but
   enforces nothing. Measure attestation pass rate, non-GMS share, latency, quota consumption.
2. **Enforce low-risk routes** with fail-closed; keep money-movement in monitor.
3. **Enforce critical routes** once the degraded mode and quota headroom are proven.

**Monitoring / dashboards**
- Attestation pass/fail rate by device class, app version, geography.
- Verdict distribution (appIntegrity / deviceIntegrity / account) feeding the risk engine.
- p50/p95 request latency (confirm the `<1 ms` signing budget; watch cold-start attestation).
- Play Integrity quota burn vs. limit.
- Rejected-request reasons (missing token, stale nonce, body-hash mismatch, degraded block).

**Operational must-haves**
- **Kill switch / feature flag** to drop from enforce → monitor without an app release, in case a
  verdict-provider incident spikes false rejections.
- **Crash symbolication:** archive R8 + obfuscation mapping files per release and upload to your
  crash reporter, or the friction layer will blind your stack traces.
- **Key rotation runbook:** JIT signing secrets rotate centrally; document and rehearse the
  rotation + revocation-on-leak procedure.
- **Clock-skew handling:** verifier tolerates configured skew; client retries on 401 by
  re-provisioning a token.

---

## 7. Threat-model reality check (set expectations with stakeholders)

Put this in front of anyone who might over-promise internally or to the customer:

- A rooted-device Frida attacker **will** read your endpoints and traffic in cleartext. Expected.
  The backend does not depend on the request being secret.
- A leaked JIT secret **expires in minutes** and is revocable — captured traffic does not scale.
- The **hostile-client problem** remains: a user can script your genuine app. Body binding stops
  blind replay; scaled abuse is caught by rate limiting, anomaly detection, and account risk
  scoring on the server.
- Attestation is **probabilistic** (keybox spoofing / bypass modules exist). It is a weighted
  signal, never a sole gate.

**Design test:** if the client SDK vanished, a correctly secured backend would still be safe.
Everything in the SDK cuts abuse cost and adds auditable integrity signals on top of that baseline.

---

## Appendix — integration checklist

**Mobile**
- [ ] Plugin applied; build fails on foot-guns; per-variant config set
- [ ] Protected interfaces annotated (`@AttestedApi`, `@Encrypted`, `@AttestationRequired`)
- [ ] `Hidesec.okHttpClient()` wired through DI; attestation warmed at startup
- [ ] Mapping files archived to crash reporter

**Backend**
- [ ] Verifier middleware on protected routes; **fail-closed** on money movement
- [ ] Verdicts verified **server-side**; body-hash binding checked; nonce anti-replay live
- [ ] Sits on top of existing authN/Z, rate limiting, anomaly detection
- [ ] Play Integrity project linked; **quota increase requested**; decryption key in secret store

**Both**
- [ ] Degraded mode defined per route class; non-GMS population measured
- [ ] Staged rollout plan (monitor → enforce); kill switch in place
- [ ] Dashboards for pass rate, latency, quota, rejection reasons
- [ ] Key rotation / revocation runbook rehearsed
