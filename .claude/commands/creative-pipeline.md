# Creative Pipeline — AI Visual Asset Generation

Generate UI mockups, images, 3D models, and components using the full creative toolchain.

## Tools Available
- **Nano Banana** (`nano-banana`) — AI image + video generation via Google Gemini
- **Google Stitch MCP** — AI-generated UI screens and layouts
- **21st.dev Magic MCP** — React/UI component generation
- **Blender MCP** — 3D model creation (requires Blender open with addon enabled)

---

## Usage

Describe what you want to create. Examples:

```
/creative-pipeline Generate a hero section for a SaaS landing page with glassmorphism cards
/creative-pipeline Create a 3D product render of a sleek wireless earbud
/creative-pipeline Design a mobile onboarding flow with 4 screens
/creative-pipeline Generate a cinematic background video of a futuristic city at night
```

---

## Image Generation (Nano Banana)

```bash
# Standard image
nano-banana "<prompt>" --model gemini-2.5-flash-image --output output/<filename>.png

# Edit existing image
nano-banana "<edit instruction>" --file <input.png> --output output/<filename>.png

# Video (8s, 1080p, with audio)
nano-banana --video "<prompt>" --output output/<filename>.mp4

# Video (fast/cheap, no audio)
nano-banana --video "<prompt>" --video-fast --no-audio --output output/<filename>.mp4
```

**Required:** `GEMINI_API_KEY` env var must be set. Get one at https://aistudio.google.com/apikey

---

## UI Components (21st.dev Magic MCP)

Use via Cursor chat with the Magic MCP server active:
- "Create a [component] with [specifications]"
- Generates production-ready React/TypeScript components

---

## UI Screens (Google Stitch MCP)

Use via Cursor chat with the Stitch MCP server active:
- `generate_screen_from_text` — create a new screen from a text description
- `build_site` — generate a full site by mapping screens to routes
- `get_screen_code` — retrieve HTML/code for a generated screen

**Required:** `gcloud auth login` must be run and authenticated.

---

## 3D Models (Blender MCP)

1. Open Blender
2. Ensure the **MCP Blender Bridge** addon is enabled (Edit → Preferences → Add-ons)
3. Use via Cursor chat — Blender MCP tools will be available

---

## Output Directory

All generated assets default to `output/` in the current project. Create it if needed:
```bash
mkdir -p output
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| "Model does not support requested response modalities" | Add `--model gemini-2.5-flash-image` flag |
| "API Key not found" | Set `GEMINI_API_KEY` — run `setx GEMINI_API_KEY "your-key"` then restart terminal |
| Blender MCP not connecting | Open Blender + enable MCP Bridge addon |
| Stitch errors | Run `gcloud auth login` |
