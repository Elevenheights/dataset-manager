#!/usr/bin/env python3
"""
Model downloader for Dataset Manager
Uses huggingface_hub with hf_transfer for fast parallel downloads
Progress is tracked by scanning .incomplete files in HF cache
"""

import sys
import json
import os
import time
import threading
from pathlib import Path

try:
    from huggingface_hub import snapshot_download, hf_hub_download, get_hf_file_metadata, hf_hub_url
    from tqdm import tqdm
except ImportError as e:
    print(json.dumps({
        'success': False,
        'error': f'Missing dependencies: {str(e)}. Run: pip install huggingface-hub hf-transfer'
    }))
    sys.exit(1)

# Global flag to stop monitoring threads
STOP_MONITORING = False

def update_progress(progress_file, downloaded, total, current_file='', speed=0, eta=0):
    """Update progress file for UI tracking"""
    if not progress_file:
        return
    
    try:
        progress_percent = min(99, int((downloaded / total * 100) if total > 0 else 0))
        progress_data = {
            'downloaded': downloaded,
            'total': total if total > 0 else downloaded,
            'progress': progress_percent,
            'current_file': current_file,
            'speed': speed,
            'eta': eta,
        }
        
        # Atomic write (write to temp then rename)
        temp_file = f"{progress_file}.tmp"
        with open(temp_file, 'w') as f:
            json.dump(progress_data, f)
        os.replace(temp_file, progress_file)
        
        # Log progress updates (but not too frequently)
        # Only log at 10% increments to reduce spam
        if progress_percent > 0 and progress_percent % 10 == 0:
            speed_str = f", {speed / (1024**2):.1f} MB/s" if speed > 0 else ""
            eta_str = f", ETA {int(eta)}s" if eta > 0 else ""
            print(f"📊 Overall Progress: {progress_percent}% ({downloaded / (1024**3):.2f} / {total / (1024**3):.2f} GB{speed_str}{eta_str})", file=sys.stderr)
        
    except Exception as e:
        # Log write errors for debugging
        print(f"⚠️  Failed to update progress file: {e}", file=sys.stderr)

def monitor_file_size_cumulative(filepath, file_size, progress_file, filename, bytes_before, total_size, file_num, total_files):
    """Monitor file size and update CUMULATIVE progress across multiple files"""
    start_time = time.time()
    last_size = 0
    last_update_time = start_time
    last_log_time = start_time
    
    # For HF downloads, the actual file might be in the cache directory
    hf_cache_dir = os.environ.get('HF_HOME', os.path.expanduser('~/.cache/huggingface'))
    
    # Keep track of paths we've checked to avoid redundant searches
    found_path = None
    
    print(f"👀 Monitoring: target={filepath}, cache={hf_cache_dir}", file=sys.stderr)
    print(f"   Cumulative tracking: {bytes_before / (1024**3):.2f} GB already downloaded", file=sys.stderr)
    
    while not STOP_MONITORING:
        current_file_size = 0
        actual_path = None
        
        # Check target filepath first (fastest check)
        if os.path.exists(filepath):
            current_file_size = os.path.getsize(filepath)
            actual_path = filepath
            if found_path != filepath:
                found_path = filepath
                print(f"✓ Found file at target location: {filepath}", file=sys.stderr)
        
        # If not at target, check previously found path (if any)
        if current_file_size == 0 and found_path and os.path.exists(found_path):
            try:
                current_file_size = os.path.getsize(found_path)
                actual_path = found_path
            except:
                pass
        
        # If still not found, check common HF cache locations
        if current_file_size == 0 and hf_cache_dir:
            base_filename = os.path.basename(filepath)
            
            # Check specific HF cache subdirectories (faster than full walk)
            search_dirs = [
                os.path.join(hf_cache_dir, 'hub'),
                os.path.join(hf_cache_dir, 'downloads'),
            ]
            
            for search_dir in search_dirs:
                if not os.path.exists(search_dir):
                    continue
                    
                try:
                    for root, dirs, files_list in os.walk(search_dir):
                        for f in files_list:
                            if (base_filename == f or base_filename in f or 
                                f.endswith('.incomplete') or '.tmp' in f):
                                full_path = os.path.join(root, f)
                                try:
                                    size = os.path.getsize(full_path)
                                    if size > current_file_size:
                                        current_file_size = size
                                        actual_path = full_path
                                        if found_path != full_path:
                                            found_path = full_path
                                            print(f"✓ Found downloading file: {full_path}", file=sys.stderr)
                                except:
                                    pass
                        
                        # Limit depth to avoid slow searches
                        if root.count(os.sep) - search_dir.count(os.sep) > 2:
                            dirs.clear()
                        
                        if current_file_size > 0:
                            break
                    
                    if current_file_size > 0:
                        break
                except Exception as e:
                    if time.time() - last_log_time > 5:
                        print(f"⚠️  Error searching {search_dir}: {e}", file=sys.stderr)
        
        # Check for temp files in parent directory
        if current_file_size == 0 and os.path.exists(os.path.dirname(filepath)):
            parent = os.path.dirname(filepath)
            base = os.path.basename(filepath)
            try:
                for f in os.listdir(parent):
                    if (f.startswith(base) or base in f) and ('.partial' in f or '.lock' in f or '.tmp' in f):
                        full_path = os.path.join(parent, f)
                        try:
                            size = os.path.getsize(full_path)
                            if size > current_file_size:
                                current_file_size = size
                                actual_path = full_path
                                if found_path != full_path:
                                    found_path = full_path
                                    print(f"✓ Found temp file: {full_path}", file=sys.stderr)
                        except:
                            pass
            except:
                pass
        
        # Update CUMULATIVE progress if we found something
        if current_file_size > 0:
            time_since_update = time.time() - last_update_time
            
            # Calculate speed based on change since last update
            if current_file_size > last_size:
                cumulative_bytes = bytes_before + current_file_size
                speed = (current_file_size - last_size) / time_since_update if time_since_update > 0 else 0
                eta = (total_size - cumulative_bytes) / speed if speed > 0 else 0
                
                update_progress(
                    progress_file, 
                    cumulative_bytes,           # Total downloaded across all files
                    total_size,                 # Total size of all files
                    f"{filename} ({file_num}/{total_files})",
                    speed=speed,
                    eta=eta
                )
                
                last_size = current_file_size
                last_update_time = time.time()
        else:
            # No file found yet, still update so UI knows we're alive
            if time.time() - last_update_time > 2:
                update_progress(
                    progress_file, 
                    bytes_before, 
                    total_size, 
                    f"Initializing {filename}..."
                )
                last_update_time = time.time()
                
            # Log periodically that we're still searching
            if time.time() - last_log_time > 10:
                print(f"⏳ Still searching for {filename}...", file=sys.stderr)
                last_log_time = time.time()
        
        time.sleep(0.5)

def monitor_file_size(filepath, total_size, progress_file, filename):
    """Monitor file size and update progress"""
    start_time = time.time()
    last_size = 0
    last_update_time = start_time
    last_log_time = start_time
    
    # For HF downloads, the actual file might be in the cache directory
    hf_cache_dir = os.environ.get('HF_HOME', os.path.expanduser('~/.cache/huggingface'))
    
    # Keep track of paths we've checked to avoid redundant searches
    checked_paths = set()
    found_path = None
    
    print(f"👀 Monitoring: target={filepath}, cache={hf_cache_dir}", file=sys.stderr)
    
    while not STOP_MONITORING:
        current_size = 0
        actual_path = None
        
        # 1. Check target filepath first (fastest check)
        if os.path.exists(filepath):
            current_size = os.path.getsize(filepath)
            actual_path = filepath
            if found_path != filepath:
                found_path = filepath
                print(f"✓ Found file at target location: {filepath}", file=sys.stderr)
        
        # 2. If not at target, check previously found path (if any)
        if current_size == 0 and found_path and os.path.exists(found_path):
            try:
                current_size = os.path.getsize(found_path)
                actual_path = found_path
            except:
                pass
        
        # 3. If still not found, check common HF cache locations
        if current_size == 0 and hf_cache_dir:
            base_filename = os.path.basename(filepath)
            
            # Check specific HF cache subdirectories (faster than full walk)
            search_dirs = [
                os.path.join(hf_cache_dir, 'hub'),
                os.path.join(hf_cache_dir, 'downloads'),
            ]
            
            for search_dir in search_dirs:
                if not os.path.exists(search_dir):
                    continue
                    
                # Only walk this directory if we haven't found the file yet
                try:
                    for root, dirs, files in os.walk(search_dir):
                        for f in files:
                            # Look for the target file or temp files
                            if (base_filename == f or base_filename in f or 
                                f.endswith('.incomplete') or '.tmp' in f):
                                full_path = os.path.join(root, f)
                                try:
                                    size = os.path.getsize(full_path)
                                    if size > current_size:
                                        current_size = size
                                        actual_path = full_path
                                        if found_path != full_path:
                                            found_path = full_path
                                            print(f"✓ Found downloading file: {full_path}", file=sys.stderr)
                                except:
                                    pass
                        
                        # Limit depth to avoid slow searches
                        if root.count(os.sep) - search_dir.count(os.sep) > 2:
                            dirs.clear()
                        
                        # If we found something, no need to continue searching
                        if current_size > 0:
                            break
                    
                    if current_size > 0:
                        break
                except Exception as e:
                    if time.time() - last_log_time > 5:
                        print(f"⚠️  Error searching {search_dir}: {e}", file=sys.stderr)
        
        # 4. Check for temp files in parent directory
        if current_size == 0 and os.path.exists(os.path.dirname(filepath)):
            parent = os.path.dirname(filepath)
            base = os.path.basename(filepath)
            try:
                for f in os.listdir(parent):
                    if (f.startswith(base) or base in f) and ('.partial' in f or '.lock' in f or '.tmp' in f):
                        full_path = os.path.join(parent, f)
                        try:
                            size = os.path.getsize(full_path)
                            if size > current_size:
                                current_size = size
                                actual_path = full_path
                                if found_path != full_path:
                                    found_path = full_path
                                    print(f"✓ Found temp file: {full_path}", file=sys.stderr)
                        except:
                            pass
            except:
                pass
        
        # Update progress if we found something
        if current_size > 0:
            time_since_update = time.time() - last_update_time
            
            # Calculate speed based on change since last update
            if current_size > last_size:
                speed = (current_size - last_size) / time_since_update if time_since_update > 0 else 0
                eta = (total_size - current_size) / speed if speed > 0 else 0
                
                update_progress(
                    progress_file, 
                    current_size, 
                    total_size, 
                    filename,
                    speed=speed,
                    eta=eta
                )
                
                last_size = current_size
                last_update_time = time.time()
        else:
            # No file found yet, still update with 0 progress so UI knows we're alive
            if time.time() - last_update_time > 2:  # Update every 2 seconds
                update_progress(progress_file, 0, total_size, f"Initializing {filename}...")
                last_update_time = time.time()
                
            # Log periodically that we're still searching
            if time.time() - last_log_time > 10:
                print(f"⏳ Still searching for {filename}...", file=sys.stderr)
                last_log_time = time.time()
        
        time.sleep(0.5)

def get_remote_file_size(repo_id, filename, token=None):
    """Get file size from HF API"""
    try:
        url = hf_hub_url(repo_id, filename)
        meta = get_hf_file_metadata(url, token=token)
        return meta.size
    except:
        return 0

def download_model(config):
    """Download a model from Hugging Face"""
    global STOP_MONITORING
    
    repo_id = config.get('repo_id')
    files = config.get('files')
    local_dir = config.get('local_dir', '/workspace/models')
    token = config.get('token')
    progress_file = config.get('progress_file')
    
    if not repo_id:
        return {'success': False, 'error': 'repo_id is required'}
    
    # Log configuration for debugging
    print(f"📋 Download configuration:", file=sys.stderr)
    print(f"   repo_id: {repo_id}", file=sys.stderr)
    print(f"   files: {files}", file=sys.stderr)
    print(f"   local_dir: {local_dir}", file=sys.stderr)
    print(f"   progress_file: {progress_file}", file=sys.stderr)
    
    # Initialize progress file immediately
    if progress_file:
        try:
            # Ensure progress file directory exists
            progress_dir = os.path.dirname(progress_file)
            if progress_dir and not os.path.exists(progress_dir):
                os.makedirs(progress_dir, exist_ok=True)
            
            update_progress(progress_file, 0, 100, "Starting download...")
            print(f"✓ Progress file initialized: {progress_file}", file=sys.stderr)
        except Exception as e:
            print(f"⚠️  Failed to initialize progress file: {e}", file=sys.stderr)
    
    # Enable hf_transfer for fast parallel downloads
    # Progress is tracked by scanning .incomplete files in HF cache
    os.environ['HF_HUB_ENABLE_HF_TRANSFER'] = '1'
    print(f"✅ hf_transfer ENABLED for fast downloads", file=sys.stderr)
    
    # Create target directory if it doesn't exist
    os.makedirs(local_dir, exist_ok=True)
    print(f"✓ Target directory ready: {local_dir}", file=sys.stderr)
    
    try:
        # If specific files are requested, download them individually
        if files and isinstance(files, list) and len(files) > 0:
            downloaded_files = []
            total_files = len(files)
            
            # STEP 1: Get total size of all files for cumulative progress
            print(f"🔍 Getting file sizes for {total_files} files...", file=sys.stderr)
            file_sizes = []
            total_download_size = 0
            for filename in files:
                size = get_remote_file_size(repo_id, filename, token)
                file_sizes.append(size)
                total_download_size += size
                if size > 0:
                    print(f"   {filename}: {size / (1024**3):.2f} GB", file=sys.stderr)
            
            if total_download_size > 0:
                print(f"📊 Total download size: {total_download_size / (1024**3):.2f} GB", file=sys.stderr)
            
            cumulative_downloaded = 0  # Track bytes downloaded across ALL files
            
            # STEP 2: Download each file, tracking cumulative progress
            for idx, filename in enumerate(files):
                print(f"📥 Downloading {filename} from {repo_id}... ({idx+1}/{total_files})", file=sys.stderr)
                
                expected_size = file_sizes[idx]
                bytes_before_this_file = cumulative_downloaded
                
                # Update progress - starting this file
                update_progress(
                    progress_file, 
                    cumulative_downloaded, 
                    total_download_size, 
                    f"Downloading {filename} ({idx+1}/{total_files})..."
                )
                
                try:
                    print(f"⬇️  Starting download of {filename}...", file=sys.stderr)
                    file_path = hf_hub_download(
                        repo_id=repo_id,
                        filename=filename,
                        local_dir=local_dir,
                        local_dir_use_symlinks=False,
                        token=token,
                    )
                    downloaded_files.append(file_path)
                    print(f"✅ Completed download of {filename}", file=sys.stderr)
                    
                    # Update cumulative progress
                    cumulative_downloaded += expected_size
                    
                except Exception as e:
                    print(f"❌ Error downloading {filename}: {e}", file=sys.stderr)
                    raise
                
                # Update progress after this file completes
                update_progress(
                    progress_file, 
                    cumulative_downloaded, 
                    total_download_size, 
                    f"Completed {filename}"
                )
            
            result = {
                'success': True,
                'files': downloaded_files,
                'count': len(downloaded_files),
            }
            print(json.dumps(result))
            
        else:
            # Download entire repository (snapshot)
            print(f"Downloading repository {repo_id}...", file=sys.stderr)
            update_progress(progress_file, 0, 100, 'Starting repository download...')
            
            cache_dir = snapshot_download(
                repo_id=repo_id,
                local_dir=local_dir,
                local_dir_use_symlinks=False,
                token=token,
            )
            
            update_progress(progress_file, 100, 100, 'Complete')
            
            result = {
                'success': True,
                'path': cache_dir,
                'debug_local_dir': local_dir,
            }
            print(json.dumps(result))
            
        sys.stdout.flush()
        return {'success': True}
        
    except Exception as e:
        error_msg = str(e)
        print(json.dumps({
            'success': False,
            'error': error_msg
        }))
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python download_model.py <config_json>'
        }))
        sys.exit(1)
    
    try:
        config = json.loads(sys.argv[1])
        download_model(config)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)
