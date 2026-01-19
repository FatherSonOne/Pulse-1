# 🎤 Whisper API - Quick Start (5 Minutes)

## Step 1: Get OpenAI API Key (2 minutes)

1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)
4. Keep it safe!

---

## Step 2: Add Key to Your App (1 minute)

### Option A: Environment Variable (Recommended)

Create or edit `.env` file in your project root:

```bash
VITE_OPENAI_API_KEY=sk-your-actual-key-here
```

Then restart your dev server:
```bash
npm run dev
```

### Option B: Settings UI

If your app has a Settings page, add the key there:

```typescript
// In Settings.tsx or similar
const [openAiKey, setOpenAiKey] = useState('');

// Save to localStorage or database
localStorage.setItem('openai_api_key', openAiKey);
```

---

## Step 3: Test It! (2 minutes)

### Test Voice Commands:

1. Open your app
2. Click the voice command button (🎤)
3. Say clearly: **"Open messages"**
4. Watch it transcribe perfectly! ✅

### Test Voice Memos:

1. Go to voice recorder/Voxer
2. Record a message
3. Click transcribe
4. See accurate transcription with punctuation! ✅

---

## ✅ How to Know It's Working

### Console Logs:

You should see these messages in your browser console:

```
🎤 Starting Whisper API recording...
🎤 Recording started...
🎤 Recording stopped, processing with Whisper...
📊 Audio blob size: 45.23 KB
✅ Whisper transcription: Open messages
```

### Visual Indicators:

- Voice button shows "🎤 Listening..." while recording
- Transcription appears almost instantly (2-5 seconds)
- Text includes proper punctuation and capitalization

---

## 🎯 Quick Test Commands

Try saying these to test accuracy:

### Navigation:
- ✅ "Open messages"
- ✅ "Go to calendar"
- ✅ "Show me the dashboard"
- ✅ "Open War Room"

### Actions:
- ✅ "Create a task for tomorrow"
- ✅ "Send email to John"
- ✅ "Schedule meeting at 3pm"
- ✅ "Add note about project deadline"

### Complex Sentences:
- ✅ "Search for emails from Sarah about the Q4 budget"
- ✅ "Create a task: Review the marketing proposal by Friday"
- ✅ "Remind me to call the client at 2:30pm tomorrow"

---

## 🐛 Troubleshooting

### "Whisper transcription failed"

**Check:**
1. Is your API key correct? (starts with `sk-`)
2. Do you have credits in your OpenAI account?
3. Is your internet connection working?

**Fix:**
```typescript
// Check console for detailed error
// Common errors:
// - "Invalid API key" → Check your key
// - "Insufficient credits" → Add credits to OpenAI account
// - "Network error" → Check internet connection
```

### "No speech detected"

**Check:**
1. Is your microphone working?
2. Did you grant microphone permissions?
3. Did you speak loud enough?

**Fix:**
- Speak closer to microphone
- Check browser permissions (chrome://settings/content/microphone)
- Try recording a longer message (at least 1 second)

### "Still using Web Speech API"

**Check:**
1. Is OpenAI key set correctly?
2. Did you restart the app after adding the key?

**Fix:**
```typescript
// Verify key is loaded
console.log('OpenAI Key:', openAiKey ? 'Set ✅' : 'Missing ❌');

// Force Whisper provider
const voiceToText = useVoiceToText({
  provider: 'openai', // Force Whisper
  openaiApiKey: openAiKey,
});
```

---

## 💰 Cost Check

### Monitor Usage:

1. Go to https://platform.openai.com/usage
2. Check "Audio" usage
3. Each minute costs $0.006

### Typical Costs:

| Usage | Cost/Day | Cost/Month |
|-------|----------|------------|
| 10 min/day | $0.06 | $1.80 |
| 30 min/day | $0.18 | $5.40 |
| 1 hour/day | $0.36 | $10.80 |
| 2 hours/day | $0.72 | $21.60 |

---

## 🎉 Success Indicators

You'll know Whisper is working when:

✅ **Accuracy is 95%+** (vs 70% before)  
✅ **Punctuation appears** automatically  
✅ **Capitalization is correct**  
✅ **Accents are understood** perfectly  
✅ **Complex sentences work** flawlessly  
✅ **Console shows** "✅ Whisper transcription: ..."  

---

## 🚀 Advanced Usage

### Specify Language:

```typescript
const result = await whisperService.transcribe(audioBlob, {
  language: 'es', // Spanish
});
```

### Get Timestamps:

```typescript
const result = await whisperService.transcribe(audioBlob, {
  response_format: 'verbose_json',
});

result.segments.forEach(segment => {
  console.log(`[${segment.start}s]: ${segment.text}`);
});
```

### Translate to English:

```typescript
// Speak in any language, get English translation
const result = await whisperService.translate(audioBlob);
console.log(result.text); // Always in English
```

---

## 📚 Next Steps

1. ✅ Test all voice commands
2. ✅ Try different languages
3. ✅ Test in noisy environments
4. ✅ Monitor costs in OpenAI dashboard
5. ✅ Read full guide: `WHISPER-API-INTEGRATION-GUIDE.md`

---

## 🎯 Quick Reference

### Where Whisper is Used:

1. **Voice Commands** (`useVoiceCommands` hook)
   - Automatically uses Whisper when OpenAI key is set
   
2. **Voice Recorder** (`AudioVoiceServiceGemini`)
   - Pass OpenAI key as second parameter
   
3. **Voice-to-Text** (`useVoiceToText` hook)
   - Set `provider: 'openai'` or let it auto-detect

### Key Files:

- `src/services/whisperService.ts` - Whisper API service
- `src/hooks/useVoiceToText.ts` - Voice-to-text hook
- `src/services/audioVoiceServiceGemini.ts` - Voice recorder service

---

**That's it! Your voice recognition should now be incredibly accurate! 🎤✨**

If you have any issues, check the console logs or see the full guide for troubleshooting.
