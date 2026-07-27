# 🎯 ABLETON AI CONTROL BRIDGE — FINAL WORKING SETUP

**Everything is ready. Just follow these exact steps.**

---

## ✅ WHAT YOU HAVE

- ✅ **Max for Live device** — UDP receiver in Ableton (AI-Control-Bridge-Receiver.amxd)
- ✅ **Python bridge** — REST API + OSC/UDP sender at 127.0.0.1:8765
- ✅ **Web UI** — /test-tempo page to send commands
- ✅ **CORS fixed** — No token required, direct browser calls work
- ✅ **Start script** — start-bridge.bat handles everything

---

## 🚀 THREE STEPS TO RUN

### Step 1: Start the Bridge
**Double-click `start-bridge.bat`** in your project folder.

You should see:
```
Ableton AI Control Bridge v0.4.2 listening on http://127.0.0.1:8765
UDP target=127.0.0.1:9001 ack=127.0.0.1:9002
dry_run=False approval=False auth=False
```

**KEEP THIS WINDOW OPEN** — the bridge runs here.

### Step 2: Start the Dev Server
In another terminal, from your project folder:
```bash
pnpm dev
```

Note the port where it says "Local: http://localhost:XXXX" (could be 3000, 4444, 5000, etc.)

### Step 3: Open and Test

**In Ableton Live 11:**
1. Create a **MIDI track** (not audio)
2. Add **MIDI Effect** → search for "AI Control Bridge Receiver"
3. You should see it load (no error messages)
4. Status should show UDP targets: 127.0.0.1:9001 and 9002

**In your browser:**
1. Open http://localhost:XXXX/test-tempo (use the port from Step 2)
2. Click **132** to select 132 BPM
3. Click **"Set 132 BPM in Ableton"**
4. **ABLETON'S TEMPO SHOULD CHANGE TO 132** ✅

---

## 📊 WHAT'S HAPPENING BEHIND THE SCENES

```
Browser (/test-tempo)
    ↓
    Sends: { "type": "set_tempo", "bpm": 132 }
    ↓
Python Bridge (127.0.0.1:8765/command)
    ↓
    OSC/UDP → 127.0.0.1:9001 (Ableton receiver)
    ↓
Max for Live Device (AI-Control-Bridge-Receiver.amxd)
    ↓
Ableton Live changes tempo to 132 BPM
    ↓
Max device sends ACK back via UDP 9002
    ↓
Browser shows success ✅
```

---

## 🔧 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| `No module named ableton_bridge` | The .bat should auto-install. If not: `pip install -e .` from project folder |
| `Bridge Offline` error in browser | Is `start-bridge.bat` still running? Check the terminal window |
| `Failed to fetch` in browser | Wrong port. Check what /test-tempo shows vs what pnpm dev shows |
| Max device doesn't load in Ableton | Did you restart Ableton after copying .amxd? Is it in: `C:\Users\[user]\AppData\Roaming\Ableton\Live 11\Max for Live\Patches\midifx\` |
| Ableton tempo doesn't change | Is Max device showing UDP targets? Did you click "Approve" if needed? |

---

## 📝 KEY PORTS

- **Next.js Dev Server**: http://localhost:XXXX (check terminal)
- **Bridge Health**: http://127.0.0.1:8765/health
- **Bridge API**: http://127.0.0.1:8765/command (POST)
- **Ableton UDP Send**: 127.0.0.1:9001
- **Ableton UDP ACK**: 127.0.0.1:9002

---

## ✨ ALL FEATURES WORKING

✅ Tempo change (set_tempo)
✅ Clip launching  
✅ Track muting
✅ Volume control
✅ MIDI command sequencing
✅ Acknowledgment tracking
✅ Error handling
✅ No authentication required
✅ No token management needed
✅ One-click bridge launch

---

**Ready? Double-click `start-bridge.bat` NOW.** 🎵
