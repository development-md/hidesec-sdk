# hidesec-sdk

Feasibility research and reference architecture for an Android SDK that protects the REST API
surface of mobile apps — evaluated for security value, developer experience, performance, and
enterprise production readiness.

## The problem

Static analysis of an Android APK (jadx, apktool, APKLeaks) reliably exposes the app's entire
network contract: base URLs and endpoint paths, Retrofit annotations, request/response models,
header names, and any embedded API keys. R8/ProGuard does not change this — it renames symbols
but deliberately never encrypts string literals, and Retrofit's bundled keep-rules preserve the
very annotations that describe the API.

## The verdict (TL;DR)

**"Hide the API from an attacker" is not solvable client-side — by any SDK, in any language,
including native C++.** Anything the app can decrypt, an attacker running the app can decrypt;
anything the app sends, an attacker with Frida/objection on their own device reads before TLS.
Moving code to the NDK raises the cost of the first hour of analysis and nothing more. This is
the settled industry consensus (OWASP MASVS-RESILIENCE: resilience controls "must never be used
as a replacement for security controls").

**What *is* solvable — and what an SDK should be built around — is making a leaked endpoint or
key useless to anything that is not your genuine, unmodified app.** That means:

1. **Attestation** (Google Play Integrity / challenge-response) verified **server-side**,
2. **short-lived, attestation-gated request credentials** — no long-lived secret ever ships in
   the binary,
3. **per-request signing** bound to the request body and a nonce (anti-replay),
4. **build-time obfuscation of the endpoint table** as an explicit *friction* layer, never sold
   as secrecy.

An SDK in exactly the form factor you suggested — a Gradle plugin plus an OkHttp interceptor,
with a small NDK core and a mandatory server-side verifier — is technically feasible, has
sub-millisecond per-request overhead when attestation is amortized off the hot path, and has
direct enterprise precedent (Approov ships precisely this shape commercially; banks use the
pattern under PSD2/PCI).

## Documents

| Document | Contents |
|---|---|
| [docs/RESEARCH.md](docs/RESEARCH.md) | Full research report: threat model, what static/dynamic analysis actually gets, commercial landscape (DexGuard, Appdome, Approov, Promon, Talsec, Play Integrity…), OSS landscape, adversarial verification of the key claims, sources |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The recommended SDK architecture: components, layered defense model, developer experience, performance budget, failure modes, enterprise readiness checklist |

## Honest framing (read this before building or buying)

- Obfuscation (string encryption, NDK storage, bytecode transforms) is a **speed bump**: it
  defeats grep/jadx and scripted scanners, and buys hours against a manual attacker. It is worth
  shipping as defense-in-depth and worth nothing as a sole control.
- The **server-side verifier is the load-bearing component**. If the backend fails open, the
  entire client stack is theater — an attacker simply strips the attestation header.
- Attestation is **probabilistic**, not absolute: keybox spoofing and Play Integrity bypass
  modules exist, and a hostile user can script your genuine app. Treat verdicts as a weighted
  signal into risk scoring plus rate limiting and anomaly detection, not a binary gate.
- The durable test: **if the client SDK vanished, a correctly secured backend would still be
  safe.** Design for that, then add the client layers to cut abuse cost and scale.
