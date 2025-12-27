# PrenivDL API Documentation

> Universal Social Media Downloader API - Local API Server for NotazeDownloader

## Overview

PrenivDL API is a local Node.js server that provides a unified API for downloading videos, images, and audio from 15+ social media platforms. It acts as a middleware between your Laravel application and the PrenivAPI service.

## Quick Start

### Installation

```bash
cd prenivdlapp-cli
npm install
```

### Start Server

```bash
npm run server
# or
node server.js
```

Server runs on `http://localhost:3001` by default.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |

---

## Endpoints

### 1. Health Check

```
GET /health
```

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-12-27T18:00:00.000Z",
  "uptime": 3600
}
```

---

### 2. List Supported Platforms

```
GET /api/platforms
```

Get list of all supported platforms and their media types.

**Response:**
```json
{
  "success": true,
  "platforms": [
    { "id": "tiktok", "name": "TikTok", "types": ["video", "audio", "image"] },
    { "id": "instagram", "name": "Instagram", "types": ["video", "image"] },
    { "id": "facebook", "name": "Facebook", "types": ["video"] },
    { "id": "twitter", "name": "Twitter/X", "types": ["video"] },
    { "id": "youtube", "name": "YouTube", "types": ["video", "audio"] },
    { "id": "spotify", "name": "Spotify", "types": ["audio"] },
    ...
  ]
}
```

---

### 3. Get Video Info & Download Links

```
GET /api/info?url=<video_url>
```

Fetch video metadata and download links for a given URL.

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | Full URL of the video/post |

**Example:**
```
GET /api/info?url=https://www.tiktok.com/@user/video/1234567890
```

**Success Response:**
```json
{
  "success": true,
  "platform": "tiktok",
  "data": {
    "title": "Video title",
    "thumbnail": "https://...",
    "author": "username",
    "duration": null,
    "platform": "tiktok",
    "links": [
      {
        "url": "https://download-url...",
        "quality": "HD (No Watermark)",
        "type": "video",
        "format": "mp4"
      },
      {
        "url": "https://audio-url...",
        "quality": "Audio/Music",
        "type": "audio",
        "format": "mp3"
      }
    ]
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "platform": "tiktok"
}
```

---

### 4. Download File (Proxy)

```
GET /api/download?url=<download_url>&filename=<name>&type=<type>
```

Proxy download - streams the file with proper headers for direct download.

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | Direct download URL from /api/info |
| `filename` | No | Desired filename (without extension) |
| `type` | No | File type: `video`, `audio`, or `image` |

**Example:**
```
GET /api/download?url=https://...&filename=my_video&type=video
```

**Response:** Binary file stream with download headers.

---

## Response Data Structure

### Link Object

Each link in the `links` array contains:

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Direct download URL |
| `quality` | string | Quality label (HD, SD, 720p, etc.) |
| `type` | string | `video`, `audio`, or `image` |
| `format` | string | File format (mp4, mp3, jpg) |
| `resolution` | string | (Optional) Resolution (720, 1080, etc.) |

### Supported Platforms

| Platform | ID | Supported Types |
|----------|-----|-----------------|
| TikTok | `tiktok` | video, audio, image |
| Instagram | `instagram` | video, image |
| Facebook | `facebook` | video |
| Twitter/X | `twitter` | video |
| YouTube | `youtube` | video, audio |
| Spotify | `spotify` | audio |
| Pinterest | `pinterest` | image, video |
| Douyin | `douyin` | video |
| CapCut | `capcut` | video |
| Threads | `threads` | video |
| Bluesky | `bluesky` | video, image |
| RedNote | `rednote` | video, image |
| Kuaishou | `kuaishou` | video, image |
| Weibo | `weibo` | video, image |
| Apple Music | `applemusic` | audio |

---

## Integration with Laravel

### PrenivService.php

The Laravel service (`app/Services/PrenivService.php`) handles communication with this API:

```php
// Get video info
$result = $prenivService->getVideoInfo($url);

if ($result['success']) {
    $data = $result['data'];
    // $data['links'] contains download options
}

// Check if service is available
$isOnline = $prenivService->isAvailable();
```

### Environment Configuration

Add to `.env`:
```env
PRENIV_API_URL=http://localhost:3001
```

---

## Example Usage

### cURL

```bash
# Health check
curl http://localhost:3001/health

# Get platforms
curl http://localhost:3001/api/platforms

# Get video info
curl "http://localhost:3001/api/info?url=https://www.tiktok.com/@user/video/123"

# Download file
curl -o video.mp4 "http://localhost:3001/api/download?url=https://...&type=video"
```

### JavaScript

```javascript
// Fetch video info
const response = await fetch('/api/info?url=' + encodeURIComponent(videoUrl));
const data = await response.json();

if (data.success) {
    data.data.links.forEach(link => {
        console.log(link.quality, link.type, link.url);
    });
}
```

---

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | URL parameter is required | Missing URL in request |
| 400 | Unsupported platform | URL doesn't match any supported platform |
| 500 | Failed to fetch from API | External API error |
| 500 | Internal server error | Server error |

---

## Notes

- The server must be running for NotazeDownloader to work
- All download URLs are temporary and may expire
- For best results, use the proxy download endpoint rather than direct links
- YouTube downloads may have size/quality limitations

---

## License

GPL-3.0 - This API uses PrenivAPI which is free and open-source.
