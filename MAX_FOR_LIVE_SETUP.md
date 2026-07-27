# Ableton AI Control Bridge — Max for Live Setup

## ⚠️ REQUIREMENTS

- **Ableton Live 11** (with Max for Live license)
- **Python bridge running** at `127.0.0.1:8765` (start with `python -m ableton_bridge`)

## 📁 FOLDER STRUCTURE

The device files are in `/max-for-live/` in this project:

```
max-for-live/
├── AI-Control-Bridge-Receiver.maxpat    ← Install THIS
├── bridge_receiver.js                   ← Required by the .maxpat
└── device-build-guide.md
```

## 🔧 INSTALLATION (Windows)

### Step 1: Locate Ableton's Max for Live folder

1. Open File Explorer
2. Press `Ctrl+H` to show hidden folders
3. Navigate to:
   ```
   C:\Users\[YOUR-USERNAME]\AppData\Roaming\Ableton\Live 11\Max for Live\
   ```

### Step 2: Create the folder structure if missing

If `Patches` folder doesn't exist, create it:

```
C:\Users\[YOUR-USERNAME]\AppData\Roaming\Ableton\Live 11\
└── Max for Live\                        (create if missing)
    └── Patches\                         (create if missing)
        └── midifx\                      (create if missing)
```

### Step 3: Copy the device files

1. **Copy BOTH files** from the project:
   - `AI-Control-Bridge-Receiver.maxpat`
   - `bridge_receiver.js`

2. **Paste them into:**
   ```
   C:\Users\[YOUR-USERNAME]\AppData\Roaming\Ableton\Live 11\Max for Live\Patches\midifx\
   ```

**⚠️ IMPORTANT:** `bridge_receiver.js` MUST be in the same folder as the `.maxpat` file.

### Step 4: Restart Ableton

1. **Close Ableton Live 11 completely**
2. **Open Ableton Live 11 again**
3. Go to **Options → Rescan Max for Live Library** (wait for it to finish)

## 🎵 USING THE DEVICE

### 1. Create a MIDI track

In Ableton, click **Create → MIDI Track**

### 2. Add the device

- Click **"Add a MIDI Effect"** (the `+` symbol in the MIDI effects section)
- Search for **"AI Control Bridge Receiver"**
- Click to insert it

### 3. Start the Python bridge

In your terminal:
```bash
python -m ableton_bridge
```

You should see:
```
Bridge listening on 127.0.0.1:8765
Max receiver on UDP 9001
Ack listener on UDP 9002
```

### 4. Test it works

- Go to http://127.0.0.1:8765 in your browser (or use v0 at `/bridge/queue`)
- Send a command like `set_clip_loop`
- It should appear in Ableton Live in real-time
- The command history shows "acknowledged" status

## 🐛 TROUBLESHOOTING

### Device doesn't appear in list

**Problem:** "AI Control Bridge Receiver" doesn't show up when adding MIDI effects.

**Solution:**
1. Make sure `bridge_receiver.js` is in the **same folder** as the `.maxpat`
2. Files must be in: `C:\Users\...\Ableton\Live 11\Max for Live\Patches\midifx\`
3. NOT in OneDrive or cloud storage — use a local folder only
4. Restart Ableton completely after copying files
5. Run **Options → Rescan Max for Live Library** in Ableton

### "Only audio effects can be inserted into an audio track"

**Problem:** Error appears when trying to add the device.

**Solution:**
- Make sure you're on a **MIDI track**, not an audio track
- The device only works on MIDI tracks
- Create a new MIDI track: **Create → MIDI Track**

### Device appears but shows no connection

**Problem:** Device is loaded but bridge doesn't respond.

**Solution:**
1. Make sure the Python bridge is running:
   ```bash
   python -m ableton_bridge
   ```
2. Check that it shows:
   ```
   Bridge listening on 127.0.0.1:8765
   Max receiver on UDP 9001
   Ack listener on UDP 9002
   ```
3. If the bridge crashes, check the error in the terminal

### Max Console shows errors

**Problem:** Red text in Max Console when device loads.

**Solution:**
1. Open **Options → Max Console** (Ctrl+M)
2. Look for error messages about `bridge_receiver.js`
3. If it says "file not found" — the `.js` file is not in the same folder as the `.maxpat`

## 📝 FILES INCLUDED

| File | Purpose |
|------|---------|
| `AI-Control-Bridge-Receiver.maxpat` | Main MIDI effect device for Ableton |
| `bridge_receiver.js` | JavaScript engine that processes UDP commands |
| `device-build-guide.md` | Advanced: How to rebuild the device |

## ✅ VERIFICATION CHECKLIST

Before reporting issues, verify:

- [ ] Both `AI-Control-Bridge-Receiver.maxpat` AND `bridge_receiver.js` are copied
- [ ] Files are in: `C:\Users\...\Ableton\Live 11\Max for Live\Patches\midifx\`
- [ ] Files are NOT in OneDrive (use local folder only)
- [ ] Ableton Live 11 has been restarted after copying files
- [ ] **Options → Rescan Max for Live Library** was run
- [ ] Python bridge is running (`python -m ableton_bridge`)
- [ ] You're adding the device to a **MIDI track**, not audio track
- [ ] The device shows "UDP commands: 9001 · acknowledgements: 9002"

---

**Still having issues?** Check the Max Console for errors or open an issue with the exact error message.
