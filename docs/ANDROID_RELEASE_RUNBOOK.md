# Pulse Android Release Signing — Runbook

> **Issue #103.** Before Pulse can be uploaded to Google Play it must ship a
> **signed** Android App Bundle (`.aab`), signed with a stable release key. The
> code/config side is done (`android/app/build.gradle` resolves signing
> credentials from `keystore.properties` or env vars, and `npm run
> android:build` produces a signed AAB). This runbook covers the parts no
> commit can perform: the keystore facts, the secret formats, the build
> commands, and the Play App Signing enrollment decision. Read it top to
> bottom before your first Play upload.

---

## 1. The release keystore (already generated — do NOT regenerate)

The valid release key already exists at `android/app/pulse-release-key.jks`.
Do **not** regenerate it — see §7 only if starting over from scratch.

| Item | Value |
|---|---|
| Keystore file | `android/app/pulse-release-key.jks` |
| Key alias | `pulse-key` |
| Entry type | `PrivateKeyEntry` |
| Signature algorithm | `SHA384withRSA` |
| Validity | Jan 6 2026 → May 24 2053 |
| SHA-1 fingerprint | `FD:01:7B:E0:D2:26:AE:7F:06:4D:4E:9A:5A:B6:19:49:2E:CE:32:3C` |
| SHA-256 fingerprint | `F1:11:D9:9F:8A:63:44:4D:16:98:10:D9:9C:CC:EB:E6:BD:EC:9B:71:55:7F:6B:BA:82:64:B1:AE:9B:F0:1E:B3` |
| App id | `io.qntmpulse.app` |

> **The keystore and `keystore.properties` are gitignored and must NEVER be
> committed.** Root `.gitignore` excludes `android/app/pulse-release-key.jks`,
> `android/app/keystore.properties`, and `*.jks`; none are tracked or in
> history. Leave those rules in place.

> **Losing this keystore permanently blocks app updates** — unless Play App
> Signing is enrolled (see §6). Every future release must be signed with the
> *same* key, or Play rejects the upload. **Back it up offline** (encrypted USB
> / password manager / offline vault), along with the two passwords. Do not
> store the only copy on this working machine.

---

## 2. `keystore.properties` format (local builds)

`android/app/keystore.properties` supplies the signing credentials for local
builds. It is gitignored. Minimum required keys:

```properties
KEYSTORE_PASSWORD=<store password>
KEY_PASSWORD=<key password>
```

The gradle config (`android/app/build.gradle`) also accepts two **optional**
overrides; if absent it falls back to the historical defaults shown:

```properties
# Optional — defaults to pulse-key
KEY_ALIAS=pulse-key
# Optional — defaults to pulse-release-key.jks (resolved relative to android/app/)
KEYSTORE_FILE=pulse-release-key.jks
```

Credential resolution order in `build.gradle` is: **`keystore.properties` →
environment variable → built-in default**. If neither a password source is
present (and the keystore file is missing), the release build still runs but
emits a loud warning and produces an **UNSIGNED** artifact that Play will
reject — failing clearly rather than with a cryptic "keystore password
incorrect".

---

## 3. CI alternative — env vars (no checked-in properties file)

For CI (no `keystore.properties` on disk), provide the same credentials via
environment variables. The keystore file itself must still be materialized on
the runner (e.g. base64-decoded from a CI secret into `android/app/`):

| Env var | Purpose | Default if unset |
|---|---|---|
| `PULSE_KEYSTORE_FILE` | Keystore filename (relative to `android/app/`) | `pulse-release-key.jks` |
| `PULSE_KEYSTORE_PASSWORD` | Store password | _(none — required to sign)_ |
| `PULSE_KEY_ALIAS` | Key alias | `pulse-key` |
| `PULSE_KEY_PASSWORD` | Key password | _(none — required to sign)_ |

`keystore.properties` values win over env vars when both are present, so a CI
runner without that file uses the env vars cleanly.

---

## 4. Build commands

The signed AAB output lands at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

(This is gitignored via `android/app/.gitignore` → `/build/*`.)

**Windows (primary, this repo):**

```bash
npm run android:build
```

This runs `android:sync` (`vite build` + `npx cap sync android`) then
`android:bundle` (`cd android && gradlew bundleRelease`). npm on Windows runs
scripts via cmd.exe, which executes `gradlew.bat` from the `android/` cwd.

**Unix / macOS / Linux:** the npm script invokes `gradlew` (no `./` prefix),
which Windows cmd resolves to `gradlew.bat`. On Unix, run the wrapper
explicitly from the `android/` directory:

```bash
cd android && ./gradlew bundleRelease
```

**Capacitor-native alternative:** Capacitor CLI v8 can also drive the bundle:

```bash
npx cap build android --androidreleasetype AAB
```

(`npx cap build android` accepts optional keystore flags, but the gradle config
already resolves credentials, so the bare command is enough on a machine with
`keystore.properties` present.)

For a debug device run (no release bundle), use `npm run android:run`, which
syncs then `npx cap run android`.

---

## 5. Version codes — bump before every upload

Play **rejects duplicate version codes.** Before each upload, bump
`versionCode` in `android/app/build.gradle`:

| Field | Current value |
|---|---|
| `versionCode` | `252` |
| `versionName` | `"25.1.3"` |

- `versionCode` is the integer Play uses for ordering — it **must strictly
  increase** with every upload. Bump it (`252` → `253` → …) on each release.
- `versionName` is the human-facing string — update it when the marketing
  version changes; it does not need to be unique.

---

## 6. Upload key vs. Play App Signing (recommended model)

**Recommendation: enroll in Play App Signing.** Under this model:

- **Google holds the *app signing key*** — the key that actually signs the APKs
  delivered to users. Google generates/manages it; it never leaves Google.
- **This keystore (`pulse-release-key.jks`) becomes the *upload key*** — the key
  you sign your AAB with before uploading. Play verifies the upload signature,
  strips it, and re-signs with the app signing key.

Why this matters for disaster recovery:

- **With Play App Signing:** if you lose the *upload key*, it is **recoverable**
  — request an upload-key reset in the Play Console (register a new upload
  certificate), and continue shipping. The app signing key (held by Google) is
  unaffected, so existing users keep getting updates.
- **Without Play App Signing:** the keystore *is* the app signing key. Lose it
  and you can **never update the app** under the same listing — terminal. This
  is why §1 stresses offline backup regardless.

When enrolling / registering the upload certificate, Play will register the
fingerprints from §1 for the **upload certificate**:

- SHA-1 `FD:01:7B:E0:D2:26:AE:7F:06:4D:4E:9A:5A:B6:19:49:2E:CE:32:3C`
- SHA-256 `F1:11:D9:9F:8A:63:44:4D:16:98:10:D9:9C:CC:EB:E6:BD:EC:9B:71:55:7F:6B:BA:82:64:B1:AE:9B:F0:1E:B3`

(Note: any service that pins a fingerprint for OAuth / API access — e.g. Google
Sign-In, Maps SDK — must register the **app signing key** fingerprint that Play
generates, not the upload key, since that is what ships to users. Find it in
Play Console → Release → Setup → App signing.)

---

## 7. Generating a fresh keystore (disaster recovery only)

> **Only if starting over** — e.g. the keystore is irrecoverably lost AND the
> app is not yet on Play (or Play App Signing allows an upload-key reset). Do
> **NOT** regenerate the existing valid key; doing so changes the signing
> identity and breaks update continuity.

```bash
keytool -genkeypair \
  -keystore android/app/pulse-release-key.jks \
  -alias pulse-key \
  -keyalg RSA -keysize 2048 -sigalg SHA384withRSA \
  -validity 10000 \
  -dname "CN=Pulse, OU=QntmEcos, O=Quantum Ecosystems LLC, L=, ST=, C=US"
```

After generating, populate `android/app/keystore.properties` with the new
`KEYSTORE_PASSWORD` / `KEY_PASSWORD`, verify the fingerprints with:

```bash
keytool -list -v -keystore android/app/pulse-release-key.jks -alias pulse-key
```

…then update §1 of this runbook with the new fingerprints, back the keystore up
offline, and (if on Play App Signing) register the new upload certificate in the
Play Console.
