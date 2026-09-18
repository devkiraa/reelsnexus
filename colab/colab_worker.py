import os
import time
import requests
import subprocess
import json
import base64
from datetime import datetime, timedelta, timezone

# Google API clients
try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
except ImportError:
    subprocess.run(["pip", "install", "google-api-python-client", "google-auth-httplib2", "google-auth-oauthlib"])
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

API_BASE_URL = os.environ.get('API_BASE_URL', 'http://localhost:8787')
COLAB_API_KEY = os.environ.get('COLAB_API_KEY', 'default_dev_key')

def get_google_services(token_data):
    """Initializes YouTube and Drive services with provided OAuth token data."""
    creds = Credentials(
        token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=token_data.get("client_id"),
        client_secret=token_data.get("client_secret")
    )
    
    if not creds.valid:
        if (creds.expired or creds.token is None) and creds.refresh_token:
            print("🔄 Access token expired or missing, refreshing...")
            creds.refresh(Request())
            if "channel_id" in token_data:
                requests.post(f"{API_BASE_URL}/api/channels/{token_data['channel_id']}/token", 
                              headers={'X-Colab-Key': COLAB_API_KEY}, 
                              json={'access_token': creds.token, 'refresh_token': creds.refresh_token})
        else:
            raise RuntimeError("Invalid token and no refresh token available.")
            
    return (
        build("youtube", "v3", credentials=creds),
        build("drive", "v3", credentials=creds)
    )

def claim_job():
    headers = {'X-Colab-Key': COLAB_API_KEY}
    response = requests.post(f"{API_BASE_URL}/api/jobs/claim", headers=headers)
    if response.status_code == 200:
        return response.json()
    return None

def download_from_drive(drive_service, file_id, destination):
    from googleapiclient.http import MediaIoBaseDownload
    import io
    print(f"Downloading source video {file_id} from Master Drive...")
    request = drive_service.files().get_media(fileId=file_id)
    with io.FileIO(destination, 'wb') as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
            if status:
                print(f"Download Progress: {int(status.progress() * 100)}%")

def complete_job(job_id, youtube_video_id=None, publish_utc=None, keyframe_base64=None, niche="general"):
    headers = {'X-Colab-Key': COLAB_API_KEY}
    payload = {
        'job_id': job_id,
        'youtube_video_id': youtube_video_id,
        'youtube_scheduled_publish_utc': publish_utc,
        'keyframe_base64': keyframe_base64,
        'niche': niche,
        'status': 'SCHEDULED' if youtube_video_id else 'READY_TO_POST'
    }
    requests.post(f"{API_BASE_URL}/api/jobs/complete", headers=headers, json=payload)

def detect_video_encoder():
    result = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], stdout=subprocess.PIPE, text=True)
    if "h264_nvenc" in result.stdout:
        return ["-c:v", "h264_nvenc", "-preset", "p6", "-tune", "hq", "-b:v", "5M"]
    elif "h264_amf" in result.stdout:
        return ["-c:v", "h264_amf", "-b:v", "5M"]
    elif "h264_vaapi" in result.stdout:
        return ["-vf", "format=nv12,hwupload", "-c:v", "h264_vaapi", "-b:v", "5M"]
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "25"]

def process_video(input_path, output_path, job_data):
    print(f"Processing {input_path} with FFmpeg...")
    encoder_args = detect_video_encoder()
    
    channel_handle = job_data.get("channel_handle", "@Shorts")
    watermark_text = job_data.get("watermark_text") or channel_handle
    
    # Extract typographical configurations
    font_size = job_data.get("watermark_font_size", 36)
    font_color = job_data.get("watermark_font_color", "#FFFFFF").lstrip('#')
    opacity = job_data.get("watermark_opacity", 0.85)
    font_family = job_data.get("watermark_font_family", "Inter")
    w_padding = job_data.get("watermark_padding", 4)
    # Note: border_radius is not natively supported by ffmpeg drawtext box; we rely on padding.

    bg_enabled = job_data.get("watermark_bg_enabled", 0)
    bg_color = job_data.get("watermark_bg_color", "#000000").lstrip('#')
    bg_opacity = job_data.get("watermark_bg_opacity", 0.40)
    
    # Exact mathematical centering for x=0.5 and y=0.5, else absolute pixels mapped to 1080x1920
    x_val = job_data.get("watermark_x", 0.065)
    y_val = job_data.get("watermark_y", 0.145)
    x_pos = "(w-text_w)/2" if abs(x_val - 0.5) < 0.01 else str(int(1080 * x_val))
    y_pos = "(h-text_h)/2" if abs(y_val - 0.5) < 0.01 else str(int(1920 * y_val))

    box_str = f"box=1:boxcolor=0x{bg_color}@{bg_opacity}:boxborderw={w_padding}" if bg_enabled else "box=0"
    
    # 1.02x speed shift (setpts=0.98*PTS)
    # Micro-contrast (eq=contrast=1.05:brightness=-0.02)
    vf_chain = (
        "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920,"
        "setpts=0.98*PTS,"
        "eq=contrast=1.05:brightness=-0.02,"
        f"drawtext=text='{watermark_text}':font='{font_family}':fontcolor=0x{font_color}@{opacity}:fontsize={font_size}:x={x_pos}:y={y_pos}:{box_str}"
    )
    
    # Audio speed shift to match 1.02x video
    af_chain = "atempo=1.02"
    
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", vf_chain,
        "-af", af_chain
    ] + encoder_args + [output_path]
    
    subprocess.run(cmd, check=True)
    
    # Extract keyframe at exactly 1.5 seconds
    frame_path = output_path.replace('.mp4', '_frame.jpg')
    print(f"Extracting keyframe to {frame_path}...")
    subprocess.run(["ffmpeg", "-y", "-ss", "00:00:01.500", "-i", output_path, "-vframes", "1", "-q:v", "2", frame_path])
    
    return output_path, frame_path

def get_or_create_drive_folder(drive_service, path_string):
    # path_string example: "ReelNexus/exported_videos/TechShorts"
    folders = path_string.split('/')
    parent_id = 'root'
    
    for folder_name in folders:
        if not folder_name: continue
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and '{parent_id}' in parents and trashed=false"
        results = drive_service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        files = results.get('files', [])
        
        if files:
            parent_id = files[0].get('id')
        else:
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_id]
            }
            folder = drive_service.files().create(body=file_metadata, fields='id').execute()
            parent_id = folder.get('id')
            
    return parent_id

def upload_to_drive(drive_service, file_path, folder_id, mime_type):
    file_metadata = {
        'name': os.path.basename(file_path),
        'parents': [folder_id]
    }
    media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
    file = drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    return file.get('id')

def get_channel_schedule(channel_id):
    headers = {'X-Colab-Key': COLAB_API_KEY}
    resp = requests.get(f"{API_BASE_URL}/api/channels/{channel_id}/scheduled", headers=headers)
    if resp.status_code == 200:
        return resp.json()
    return {"uploads_last_24h": 0, "latest_scheduled_utc": datetime.now(timezone.utc).isoformat()}

def upload_to_youtube(youtube, video_path, metadata, schedule_data):
    if schedule_data["uploads_last_24h"] >= 5:
        print("⚠️ Quota limit reached (5 uploads per 24h). Delaying upload.")
        return None, None

    latest_dt = datetime.fromisoformat(schedule_data["latest_scheduled_utc"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    
    # 4-hour spacing
    target_dt = max(now + timedelta(hours=4), latest_dt + timedelta(hours=4))
    publish_at_rfc3339 = target_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    print(f"⬆️ Uploading to YouTube. Scheduled for: {publish_at_rfc3339}")
    body = {
        "snippet": {
            "title": (metadata.get("ai_title") or "Untitled Short") + " #Shorts",
            "description": metadata.get("ai_description") or "",
            "tags": (metadata.get("ai_tags") or "").split(","),
            "categoryId": "22"
        },
        "status": {
            "privacyStatus": "private", 
            "publishAt": publish_at_rfc3339,
            "selfDeclaredMadeForKids": False
        }
    }
    
    media = MediaFileUpload(video_path, chunksize=8*1024*1024, resumable=True)
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media
    )
    
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"   ... {int(status.progress() * 100)}%")
            
    print(f"✅ YouTube Upload sukses. Video ID: {response['id']}")
    return response['id'], publish_at_rfc3339

def main_loop():
    while True:
        job = claim_job()
        if job:
            print(f"Claimed job: {job['id']}")
            input_path = f"/tmp/{job['file_name']}"
            
            # Download actual video if we have credentials
            if job.get("master_drive_token_data"):
                _, master_drive = get_google_services(job["master_drive_token_data"])
                download_from_drive(master_drive, job.get('source_file_id') or job.get('raw_drive_id'), input_path)
            else:
                with open(input_path, 'w') as f: f.write('dummy raw video')

            output_path = f"/tmp/processed_{job['file_name']}"
            
            try:
                out_vid, out_frame = process_video(input_path, output_path, job)
                
                with open(out_frame, "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                
                yt_video_id = None
                publish_utc = None
                
                if job.get("youtube_token_data"):
                    youtube, _ = get_google_services(job["youtube_token_data"])
                    
                    target_path = job.get("target_drive_folder_path")
                    if target_path and job.get("master_drive_token_data"):
                        print(f"Creating/getting Drive structure: {target_path}")
                        folder_id = get_or_create_drive_folder(master_drive, target_path)
                        print("Uploading backup to Drive...")
                        upload_to_drive(master_drive, out_vid, folder_id, 'video/mp4')
                        upload_to_drive(master_drive, out_frame, folder_id, 'image/jpeg')
                    
                    # Ensure Quota protection
                    schedule_data = get_channel_schedule(job["channel_id"])
                    yt_video_id, publish_utc = upload_to_youtube(youtube, out_vid, job, schedule_data)
                
                complete_job(job['id'], youtube_video_id=yt_video_id, publish_utc=publish_utc, keyframe_base64=encoded_string, niche=job.get("channel_niche", "general"))
                print(f"Completed job: {job['id']}")
                
            except Exception as e:
                print(f"❌ Error processing job {job['id']}: {e}")
        else:
            print("No jobs queued for render. Dispatch videos from the dashboard queue to begin. Sleeping 30s...")
            time.sleep(30)

if __name__ == "__main__":
    print("Starting ReelNexus Colab Worker with Quota Protection & Backups...")
    main_loop()
