const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { getApi, normalizer } = require('./routes/api');
const { fetchJson } = require('./utils/functions');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Platform detection from URL
function detectPlatform(url) {
    const patterns = {
        tiktok: /tiktok\.com|vm\.tiktok/i,
        instagram: /instagram\.com|instagr\.am/i,
        facebook: /facebook\.com|fb\.watch|fb\.com/i,
        twitter: /twitter\.com|x\.com/i,
        youtube: /youtube\.com|youtu\.be/i,
        douyin: /douyin\.com/i,
        spotify: /spotify\.com/i,
        pinterest: /pinterest\.com|pin\.it/i,
        applemusic: /music\.apple\.com/i,
        capcut: /capcut\.com/i,
        bluesky: /bsky\.app/i,
        rednote: /xiaohongshu\.com|xhslink\.com/i,
        threads: /threads\.net/i,
        kuaishou: /kuaishou\.com|ksurl\.cn/i,
        weibo: /weibo\.com/i,
    };

    for (const [platform, pattern] of Object.entries(patterns)) {
        if (pattern.test(url)) {
            return platform;
        }
    }
    return null;
}

// Get supported platforms list
app.get('/api/platforms', (req, res) => {
    res.json({
        success: true,
        platforms: [
            { id: 'tiktok', name: 'TikTok', types: ['video', 'audio', 'image'] },
            { id: 'instagram', name: 'Instagram', types: ['video', 'image'] },
            { id: 'facebook', name: 'Facebook', types: ['video'] },
            { id: 'twitter', name: 'Twitter/X', types: ['video'] },
            { id: 'youtube', name: 'YouTube', types: ['video', 'audio'] },
            { id: 'spotify', name: 'Spotify', types: ['audio'] },
            { id: 'pinterest', name: 'Pinterest', types: ['image', 'video'] },
            { id: 'douyin', name: 'Douyin', types: ['video'] },
            { id: 'capcut', name: 'CapCut', types: ['video'] },
            { id: 'threads', name: 'Threads', types: ['video'] },
            { id: 'bluesky', name: 'Bluesky', types: ['video', 'image'] },
            { id: 'rednote', name: 'RedNote/Xiaohongshu', types: ['video', 'image'] },
            { id: 'kuaishou', name: 'Kuaishou', types: ['video', 'image'] },
            { id: 'weibo', name: 'Weibo', types: ['video', 'image'] },
            { id: 'applemusic', name: 'Apple Music', types: ['audio'] },
        ]
    });
});

// Get video info and download links
app.get('/api/info', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }

        const platform = detectPlatform(url);
        if (!platform) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported platform. Use /api/platforms to see supported platforms.'
            });
        }

        const apiUrl = getApi[platform];
        if (!apiUrl) {
            return res.status(400).json({
                success: false,
                error: `API not configured for ${platform}`
            });
        }

        console.log(`[${new Date().toISOString()}] Fetching: ${platform} - ${url.substring(0, 50)}...`);

        // Fetch from PrenivAPI
        const response = await fetchJson(`${apiUrl}${encodeURIComponent(url)}`, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36'
            }
        });

        if (!response || !response.status) {
            return res.status(500).json({
                success: false,
                error: response?.msg || 'Failed to fetch from API',
                platform
            });
        }

        // Normalize based on platform
        let normalized;
        try {
            switch (platform) {
                case 'tiktok':
                    normalized = normalizer.normalizeTikTok(response.data, 'primary');
                    break;
                case 'instagram':
                    normalized = normalizer.normalizeInstagram(response.data, 'primary');
                    break;
                case 'facebook':
                    normalized = normalizer.normalizeFacebook(response.data, 'primary');
                    break;
                case 'youtube':
                    normalized = normalizer.normalizeYouTube(response.data, 'primary');
                    break;
                case 'spotify':
                    normalized = normalizer.normalizeSpotify(response.data, 'primary');
                    break;
                default:
                    normalized = response.data;
            }
        } catch (e) {
            normalized = response.data;
        }

        // Transform to unified response format
        const result = transformToUnified(platform, normalized, response.data);

        console.log(`[${new Date().toISOString()}] Success: ${platform} - ${result.links.length} links found`);

        res.json({
            success: true,
            platform,
            data: result
        });

    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Transform normalized data to unified format
function transformToUnified(platform, normalized, raw) {
    const result = {
        title: null,
        thumbnail: null,
        author: null,
        duration: null,
        platform,
        links: []
    };

    // ===== TikTok =====
    if (platform === 'tiktok') {
        result.title = normalized.title || raw?.title;
        result.thumbnail = normalized.thumbnail || raw?.thumbnail;
        result.author = normalized.author || raw?.author;

        if (normalized.downloads?.video?.length) {
            normalized.downloads.video.forEach((url, i) => {
                const urlStr = typeof url === 'string' ? url : url.url;
                result.links.push({
                    url: urlStr,
                    quality: i === 0 ? 'HD (No Watermark)' : `Video Option ${i + 1}`,
                    type: 'video',
                    format: 'mp4'
                });
            });
        }
        if (normalized.downloads?.audio?.length) {
            normalized.downloads.audio.forEach((url, i) => {
                const urlStr = typeof url === 'string' ? url : url.url;
                result.links.push({
                    url: urlStr,
                    quality: normalized.metadata?.audio_title || 'Audio/Music',
                    type: 'audio',
                    format: 'mp3'
                });
            });
        }
        if (normalized.downloads?.image?.length) {
            normalized.downloads.image.forEach((url, i) => {
                const urlStr = typeof url === 'string' ? url : url.url;
                result.links.push({
                    url: urlStr,
                    quality: `Image ${i + 1}`,
                    type: 'image',
                    format: 'jpg'
                });
            });
        }
    }

    // ===== Instagram =====
    else if (platform === 'instagram') {
        result.title = 'Instagram Media';
        result.thumbnail = normalized?.media?.[0]?.thumbnail || raw?.thumb;

        if (normalized?.media?.length) {
            normalized.media.forEach((item, i) => {
                const url = item?.url || item;
                if (!url || typeof url !== 'string') return;
                const urlLower = url.toLowerCase();
                const isVideo = urlLower.includes('.mp4') || urlLower.includes('video');
                result.links.push({
                    url,
                    quality: isVideo ? `Video ${i + 1}` : `Photo ${i + 1}`,
                    type: isVideo ? 'video' : 'image',
                    format: isVideo ? 'mp4' : 'jpg'
                });
            });
        }

        // Fallback: try to get download_url from raw data
        if (result.links.length === 0 && raw?.download_url) {
            const dlUrl = Array.isArray(raw.download_url) ? raw.download_url : [raw.download_url];
            dlUrl.forEach((url, i) => {
                if (!url || typeof url !== 'string') return;
                const urlLower = url.toLowerCase();
                const isVideo = urlLower.includes('.mp4') || urlLower.includes('video');
                result.links.push({
                    url,
                    quality: isVideo ? `Video ${i + 1}` : `Photo ${i + 1}`,
                    type: isVideo ? 'video' : 'image',
                    format: isVideo ? 'mp4' : 'jpg'
                });
            });
        }

        result.thumbnail = result.thumbnail || raw?.thumb;
    }

    // ===== Facebook =====
    else if (platform === 'facebook') {
        result.title = raw?.title || 'Facebook Video';
        result.thumbnail = raw?.thumbnail;

        if (normalized.downloads?.length) {
            normalized.downloads.forEach(item => {
                result.links.push({
                    url: item.url,
                    quality: item.quality || item.resolution || 'Video',
                    type: 'video',
                    format: 'mp4',
                    resolution: item.resolution
                });
            });
        }
    }

    // ===== Twitter/X =====
    else if (platform === 'twitter') {
        result.title = raw?.title || 'Twitter Video';
        result.thumbnail = raw?.thumbnail;

        if (Array.isArray(raw)) {
            raw.forEach((item, i) => {
                result.links.push({
                    url: item.url || item,
                    quality: item.quality ? `${item.quality}p` : `Video ${i + 1}`,
                    type: 'video',
                    format: 'mp4',
                    resolution: item.quality
                });
            });
        } else if (raw?.media) {
            raw.media.forEach((item, i) => {
                result.links.push({
                    url: item.url,
                    quality: `${item.quality}p`,
                    type: 'video',
                    format: 'mp4',
                    resolution: item.quality
                });
            });
        }
    }

    // ===== YouTube =====
    else if (platform === 'youtube') {
        result.title = normalized.title || raw?.title;
        result.thumbnail = normalized.thumbnail || raw?.thumbnail;
        result.author = normalized.author || raw?.author;
        result.duration = normalized.duration || raw?.duration;

        // Define preferred resolutions (only these will be shown)
        const preferredResolutions = ['360p', '480p', '720p', '1080p'];
        const seenResolutions = new Set();

        if (normalized.downloads?.video?.length) {
            normalized.downloads.video.forEach(item => {
                const quality = item.quality || 'Video';
                // Only add if it's a preferred resolution and not seen before
                if (preferredResolutions.includes(quality) && !seenResolutions.has(quality)) {
                    seenResolutions.add(quality);
                    result.links.push({
                        url: item.url,
                        quality: quality,
                        type: item.type || 'video',
                        format: item.format || 'mp4',
                        resolution: quality
                    });
                }
            });
        }

        // Add max 1 audio option
        if (normalized.downloads?.audio?.length) {
            const bestAudio = normalized.downloads.audio[0];
            if (bestAudio) {
                result.links.push({
                    url: bestAudio.url,
                    quality: 'Audio MP3',
                    type: 'audio',
                    format: bestAudio.format || 'mp3'
                });
            }
        }
    }

    // ===== Spotify =====
    else if (platform === 'spotify') {
        result.title = normalized.title || raw?.title;
        result.thumbnail = normalized.thumbnail || raw?.thumbnail;
        result.author = normalized.author;
        result.duration = normalized.duration;

        if (normalized.downloads?.length) {
            normalized.downloads.forEach(item => {
                result.links.push({
                    url: item.url,
                    quality: item.quality || 'MP3',
                    type: 'audio',
                    format: item.format || 'mp3'
                });
            });
        }
    }

    // ===== Other platforms =====
    else {
        result.title = raw?.title || normalized?.title || `${platform} Media`;
        result.thumbnail = raw?.thumbnail || normalized?.thumbnail;
        result.author = raw?.author || normalized?.author;

        // Extract URLs from various formats
        const urls = extractUrls(raw);
        urls.forEach((url, i) => {
            const isAudio = url.includes('.mp3') || url.includes('.m4a');
            const isImage = url.includes('.jpg') || url.includes('.png') || url.includes('.webp');
            result.links.push({
                url,
                quality: `Download ${i + 1}`,
                type: isAudio ? 'audio' : (isImage ? 'image' : 'video'),
                format: isAudio ? 'mp3' : (isImage ? 'jpg' : 'mp4')
            });
        });
    }

    return result;
}

// Extract URLs from complex response objects
function extractUrls(obj, urls = [], visited = new Set()) {
    if (!obj || visited.has(obj)) return urls;

    if (typeof obj === 'object') visited.add(obj);

    if (typeof obj === 'string' && (obj.startsWith('http://') || obj.startsWith('https://'))) {
        if (!urls.includes(obj) && !obj.includes('thumbnail') && !obj.includes('cover')) {
            urls.push(obj);
        }
    } else if (Array.isArray(obj)) {
        obj.forEach(item => extractUrls(item, urls, visited));
    } else if (typeof obj === 'object') {
        const urlFields = ['url', 'download_url', 'downloadUrl', 'video', 'audio', 'mp4', 'mp3', 'hd', 'sd'];
        for (const field of urlFields) {
            if (obj[field]) extractUrls(obj[field], urls, visited);
        }
    }

    return urls;
}

// Proxy download endpoint
app.get('/api/download', async (req, res) => {
    try {
        const { url, filename, type } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL parameter is required'
            });
        }

        console.log(`[${new Date().toISOString()}] Downloading: ${type || 'video'} - ${url.substring(0, 50)}...`);

        // Determine file extension
        let ext = 'mp4';
        let contentType = 'video/mp4';
        if (type === 'audio') {
            ext = 'mp3';
            contentType = 'audio/mpeg';
        } else if (type === 'image') {
            ext = 'jpg';
            contentType = 'image/jpeg';
        }

        const safeFilename = (filename || 'download').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);

        // Stream the file
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 120000
        });

        // Use actual content type if available
        const actualContentType = response.headers['content-type'] || contentType;

        // Set headers for download
        res.setHeader('Content-Type', actualContentType);
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.${ext}"`);

        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        // Pipe the response
        response.data.pipe(res);

    } catch (error) {
        console.error('Download Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to download file'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API documentation
app.get('/', (req, res) => {
    res.json({
        name: 'PrenivDL API Server',
        version: '1.0.0',
        description: 'Universal Social Media Downloader API',
        endpoints: {
            'GET /health': 'Health check',
            'GET /api/platforms': 'List all supported platforms',
            'GET /api/info?url=<url>': 'Get video info and download links',
            'GET /api/download?url=<url>&filename=<name>&type=<video|audio|image>': 'Download file'
        },
        documentation: '/docs'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           🚀 PrenivDL API Server v1.0.0                      ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║   Running on: http://localhost:${PORT}                          ║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║   Endpoints:                                                 ║');
    console.log('║   • GET /                      - API info                    ║');
    console.log('║   • GET /health                - Health check                ║');
    console.log('║   • GET /api/platforms         - List platforms              ║');
    console.log('║   • GET /api/info?url=<url>    - Get download links          ║');
    console.log('║   • GET /api/download?url=<url>- Download file               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;
