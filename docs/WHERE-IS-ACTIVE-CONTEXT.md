# Where to Find the Active Context Panel

## 📍 Location

The Active Context Panel appears **ABOVE the chat area** in the main content section, NOT in the sidebar.

## 🔍 Visual Layout

```
┌─────────────────┬──────────────────────────────────────┐
│                 │  ← MAIN CONTENT AREA                 │
│   SIDEBAR →     │                                      │
│                 │  ┌────────────────────────────────┐  │
│  WAR ROOMS      │  │ 🔹 ACTIVE CONTEXT   2/5  ~1K  │  │ ← HERE!
│  SESSIONS       │  │            [Clear] [Add All] ▲ │  │
│  ├─ Session 1   │  ├────────────────────────────────┤  │
│  └─ Session 2   │  │ [📄 Doc1 ×] [📄 Doc2 ×]       │  │
│                 │  └────────────────────────────────┘  │
│  CONTEXT &      │                                      │
│  SOURCES        │  ┌────────────────────────────────┐  │
│  ├─ ✅ Doc 1    │  │                                │  │
│  └─ ☐ Doc 2     │  │    Chat Messages Here          │  │
│                 │  │                                │  │
└─────────────────┴──┴────────────────────────────────┴──┘
                       ↑
                   Chat Input Here
```

## ⚠️ Requirements to See the Panel

The panel ONLY shows when:
1. ✅ You have selected a session (click on a session in the sidebar)
2. ✅ The panel is not collapsed (default is visible)

## 🎬 Steps to See It

### Step 1: Create or Select a Session
```
1. Look at the sidebar
2. Under "SESSIONS" section
3. Click "+ New" to create a session, or
4. Click on an existing session name
```

### Step 2: Look Above the Chat
```
1. Look at the main content area (right side)
2. The panel appears ABOVE the chat messages
3. Below the header, above where you type
```

### Step 3: If You Still Don't See It
- Make sure you're on the "War Room" view (not Dashboard, Messages, etc.)
- Check that you have a session selected (session name should show in header)
- The panel might be collapsed - look for a small bar saying "X documents in context [Show]"

## 📷 What It Looks Like

When **VISIBLE**:
```
┌──────────────────────────────────────────────────────┐
│ 🔹 ACTIVE CONTEXT    0 / 3    ~0 tokens             │
│                        [Clear] [Add All] [▲ Collapse]│
├──────────────────────────────────────────────────────┤
│ No documents in active context. Click documents     │
│ in the sidebar to add them.                         │
└──────────────────────────────────────────────────────┘
```

When **COLLAPSED**:
```
┌──────────────────────────────────────────────────────┐
│ 🔹 0 documents in context              [▼ Show]     │
└──────────────────────────────────────────────────────┘
```

When **ACTIVE** (with documents):
```
┌──────────────────────────────────────────────────────┐
│ 🔹 ACTIVE CONTEXT    2 / 3    ~1,250 tokens         │
│                        [Clear] [Add All] [▲ Collapse]│
├──────────────────────────────────────────────────────┤
│ [📄 My Research Paper (5 topics) ×]                 │
│ [📄 Meeting Notes (3 topics) ×]                     │
└──────────────────────────────────────────────────────┘
```

## 🐛 Troubleshooting

### "I'm in War Room but don't see it"
➡️ **Create a new session or click an existing one**

Click the "+ New" button under SESSIONS in the sidebar, enter a name, and click the checkmark. The panel will appear above the chat.

### "I see a small bar but not the full panel"
➡️ **The panel is collapsed**

Click the "Show" button on the small bar to expand it.

### "I don't have any sessions"
➡️ **Create your first session:**

1. Look for "SESSIONS" in the left sidebar
2. Click "+ New" button
3. Type a name like "Research Session"
4. Click the ✓ checkmark
5. The panel will now appear!

### "I'm not in War Room"
➡️ **Navigate to War Room:**

1. Look for navigation menu (usually top or left)
2. Click "War Room" or the brain icon
3. You should see the War Room interface

## ✨ How to Use Once You See It

1. **Upload documents** in the sidebar under "CONTEXT & SOURCES"
2. **Wait for processing** to complete (status changes to ✓)
3. **Click the checkbox** next to any document
4. **Watch it appear** in the Active Context Panel
5. **Ask a question** and AI will search only those documents

## 📱 On Mobile

The panel appears in the same location but might be:
- Narrower to fit mobile screen
- Scrollable horizontally for document chips
- Collapsed by default to save space

## 🆘 Still Can't Find It?

If you've followed all steps and still don't see it:

1. **Check console for errors**: Press F12 → Console tab
2. **Refresh the page**: Sometimes needed after updates
3. **Clear cache**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. **Check your route**: Make sure URL ends with `/war-room` or similar

---

**Quick Test:**
1. Go to War Room
2. Click "+ New" under SESSIONS
3. Type "Test" and click ✓
4. Look above where you type messages
5. You should see "ACTIVE CONTEXT" panel!
