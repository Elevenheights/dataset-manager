# Model Download Progress Tracking - Complete Fix

**Date:** December 7, 2025  
**Status:** ✅ Fixed and Enhanced

---

## Issue

When downloading models through the Model Manager page, the progress bar would remain stuck at 0% even though downloads were actively progressing (as confirmed by logs showing download activity).

---

## Root Cause

**`hf_transfer` doesn't support progress callbacks**

The high-speed `hf_transfer` library (Rust-based) is designed purely for speed and intentionally lacks progress bars:

> "This is not meant to be a general usability tool. It purposefully lacks progressbars and comes generally as-is." - hf_transfer docs

When using `hf_transfer`:
- Downloads chunks in parallel to memory/cache
- Doesn't create visible temp files until chunks are merged
- No progress callbacks or hooks available
- The original approach of reading a progress file written by Python didn't work reliably

---

## Solution

Implemented **three-layer progress tracking strategy** (same as working Qwen caption model download):

### 1. Primary: Progress File Reading
Python script writes progress to `/tmp/download_{jobId}.json`:
```json
{
  "downloaded": 5000000000,
  "total": 12000000000,
  "progress": 42,
  "speed": 50000000,
  "eta": 140
}
```

TypeScript reads this file every 1 second.

### 2. Fallback: .incomplete File Scanning
When progress file doesn't update or shows 0, scan for HuggingFace's `.incomplete` files:

```typescript
// Search paths (in order):
1. Target directory cache: {targetDir}/.cache/huggingface/download/
2. Global HF cache: /workspace/models/.cache/huggingface/download/
3. HF hub cache: /workspace/models/huggingface/hub/.cache/

// Find all .incomplete, .tmp, .partial files
// Sum their sizes = current downloaded bytes
// Progress = (sum of partial files) / (expected total size)
```

This works because HuggingFace creates `.incomplete` files during downloads, even with `hf_transfer` enabled.

### 3. Enhanced: Live Network Statistics

**NEW FEATURE:** Added real-time network usage monitoring:

- New API endpoint: `/api/system/network`
- Reads from `/proc/net/dev` (Linux)
- Calculates download/upload speed in real-time
- Updates UI every 1 second

**UI Enhancements:**
```
┌─────────────────────────────────────┐
│ Downloading Models (1)   ↓ 45.2 MB/s│ ← Live network badge
├─────────────────────────────────────┤
│ 💡 Progress may pause briefly       │ ← User-friendly message
│    during chunk transfers            │
├─────────────────────────────────────┤
│ Model Name                          │
│ [████████░░░] 49%                   │
│ 5.88 GB / 12.00 GB                  │
├─────────────────────────────────────┤
│ Network Activity:                   │
│ ↓ 45.2 MB/s  ↑ 120 KB/s            │ ← Detailed stats
└─────────────────────────────────────┘
```

---

## Implementation Details

### Files Modified

**1. `src/lib/models/downloader.ts`**
- Removed old falsy check
- Added .incomplete file scanning logic
- Added file modification time tracking
- Added stall detection (warns if no file activity for 30s)
- Logs: file count, sizes, last update time

**2. `src/components/ModelDownloadProgress.tsx`**
- Added network stats polling (1s interval)
- Added live network badge in header
- Added info message about pause behavior
- Added network activity footer
- Shows download/upload speeds with color coding

**3. `src/app/api/system/network/route.ts` (NEW)**
- Reads `/proc/net/dev` for network interface stats
- Calculates rx/tx bytes per second
- Stores previous reading to calculate rate
- Returns real-time download/upload speeds

**4. `download_model.py`**
- Re-enabled `hf_transfer` for fast downloads
- Removed unused `ProgressTqdm` class
- Progress file still written for primary tracking

---

## Progress Tracking Flow

```
┌─────────────────────────────────────────────────┐
│ Python (download_model.py)                      │
│ - Downloads with hf_transfer (50-200 MB/s)     │
│ - Writes progress file (when available)         │
│ - Creates .incomplete files in cache            │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│ TypeScript (downloader.ts) - Polls every 1s     │
│ 1. Try: Read progress file                      │
│ 2. Fallback: Scan .incomplete files             │
│ 3. Update: job.progress, downloadedBytes        │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│ UI (ModelDownloadProgress.tsx)                  │
│ - Polls download jobs every 2s                  │
│ - Polls network stats every 1s                  │
│ - Shows progress bar + network indicator        │
└─────────────────────────────────────────────────┘
```

---

## Testing

### 1. Rebuild Container
```powershell
docker stop dataset-manager-test
docker rm dataset-manager-test
docker build -t ultramuse-dataset-manager:latest .
docker run -d --name dataset-manager-test \
  -p 3000:3000 -p 11435:11435 -p 8675:8675 \
  -v dataset-manager-data:/workspace \
  ultramuse-dataset-manager:latest
```

### 2. Start Download
- Navigate to http://localhost:3000/models
- Click "Download" on any large model (e.g., Z-Image De-Turbo, 11 GB)
- Observe progress modal in bottom-right

### 3. Verify Progress Tracking

**Should see:**
- ✅ Progress starts immediately (not stuck at 0%)
- ✅ Live network badge shows download speed (e.g., "↓ 45.2 MB/s")
- ✅ Progress bar updates (may pause occasionally, that's normal)
- ✅ Info message explains pause behavior
- ✅ Network activity footer shows real-time stats

**In logs (docker logs -f):**
```
📊 Download progress: 49% (5.88 GB / 12.00 GB) | 1 files | Last update: 2s ago
📁 Found partial file: /workspace/models/.../file.incomplete (6016.0 MB)
```

**If download stalls:**
```
⚠️ Warning: No file activity for 35s - download may be stalled
```

---

## Why This Matters

### Before Fix
- Progress stuck at 0%
- No feedback for 10+ minute downloads
- Users couldn't tell if download was working or stalled
- Had to check Docker logs manually

### After Fix
- **Immediate progress feedback** starting from 0%
- **Live network stats** prove download is active
- **User-friendly messaging** explains expected behavior
- **Stall detection** warns if something's wrong
- **Multiple fallback layers** ensure progress tracking works

---

## Technical Notes

### Why Not Disable hf_transfer?

We tested disabling `hf_transfer` to use tqdm callbacks:
- ❌ Downloads 2-10x slower
- ❌ Still had issues with progress tracking
- ✅ Decided to keep hf_transfer + file scanning approach

### .incomplete File Behavior

HuggingFace downloads create these patterns:
```
/workspace/models/zimage/zimage-deturbo-bf16/.cache/huggingface/download/
└── 0q728qVxm8DfQPIk0lP15K9hLno=.{hash}.incomplete
```

Files:
- Created at download start
- Grow as chunks are written
- Renamed (remove .incomplete) when complete
- Scanned by our code to calculate progress

### Network Stats Implementation

Uses Linux `/proc/net/dev`:
```
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets...
 eth0: 1234567  8901    0    0    0    0          0         0    987654   3210...
```

Parses this, sums all interfaces (except loopback), calculates rate from previous reading.

---

## Performance Impact

**Memory:** Negligible (~1-2 KB for network stats)  
**CPU:** Very low (file stat operations, simple math)  
**Network:** None (reads local proc filesystem)  
**Disk I/O:** Minimal (stat calls, not reading file contents)

Polling frequencies:
- Network stats: 1s interval
- Download jobs: 2s interval  
- Progress file/scan: 1s interval (only during active downloads)

---

## Future Improvements

Potential enhancements for v2:
- [ ] Pause/resume downloads
- [ ] Download queue management
- [ ] Bandwidth throttling
- [ ] Parallel download limit configuration
- [ ] Historical download speed chart
- [ ] Network usage dashboard
- [ ] Notification on download complete

---

## Related Documentation

- `PROJECT_OVERVIEW.md` - Complete system overview
- `FIXES_SUMMARY.md` - All bug fixes
- `MODEL_MANAGER_README.md` - Model manager features
- `UNIFIED_MODEL_CACHE.md` - HF cache system

---

**Summary:** Model downloads now have reliable progress tracking with live network stats, giving users confidence that large downloads are working correctly even when progress temporarily pauses.
