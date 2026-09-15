# ReelNexus: Reference Patterns Audit

This document synthesizes core video processing and upload mechanisms extracted from three open-source codebases (`opensource-clipping`, `shortgpt`, and `MoneyPrinter`) for adaptation into ReelNexus.

## 1. Resumable Upload Engine
**Source**: `opensource-clipping` (`youtube_uploader/uploader.py`)
- **Mechanism**: Utilizes `googleapiclient.http.MediaFileUpload` with `resumable=True` and a specific `chunksize` (e.g., 8MB).
- **Execution**: The upload is executed in a loop using `request.next_chunk()` which returns the upload status and progress until completion.
- **Benefit**: Avoids memory bloat (loads only chunks into memory) and gracefully handles transient network disconnects.

## 2. OAuth2 Token Refresh Loop
**Source**: `opensource-clipping` (`youtube_uploader/uploader.py`)
- **Mechanism**: Utilizes `google.oauth2.credentials.Credentials`. 
- **Execution**: Checks `if not creds.valid`. If `creds.expired` and `creds.refresh_token` exists, it calls `creds.refresh(Request())` and seamlessly writes the refreshed token back to disk (or our D1 database) without triggering manual browser popups.

## 3. FFmpeg Filter Chains & Video Processing
**Source**: `opensource-clipping` and `MoneyPrinter`
- **Hardware Acceleration**: Dynamically probes for hardware encoders (e.g., `h264_nvenc` for NVIDIA, `h264_amf` for AMD) using `-hide_banner -encoders` and tests them before falling back to CPU (`libx264`).
- **Aspect Ratio Normalization (9:16)**: To ensure all videos fit the Shorts format, the video is cropped by calculating the aspect ratio `clip.w / clip.h`. If `< 0.5625`, width is preserved and height is cropped, else height is preserved and width is cropped. It is then resized to `1080x1920`.
- **Viral Hook Prompting**: Metadata (Titles, Descriptions, Search Terms/Tags) is generated via structured LLM prompts designed to output SEO-friendly titles and high-density semantic tags in JSON arrays.
