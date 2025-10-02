import { Innertube } from 'youtubei.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000; 

let yt;

async function initInnertube() {
    yt = await Innertube.create();
    console.log('Innertube Client Initialized. 🍊');
}

// --- HTML テンプレートの定義 ---

const HTML_HEAD = (title, query = '') => `
<!doctype html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>🍊 yuzutube - ${title}</title>
    <style>
        body { font-family: sans-serif; max-width: 960px; margin: auto; padding: 20px; }
        a { text-decoration: none; color: #007bff; }
        a:hover { text-decoration: underline; }
        ul { list-style: none; padding: 0; }
        li { border-bottom: 1px solid #eee; padding: 15px 0; display: flex; align-items: flex-start; }
        .thumbnail { margin-right: 15px; flex-shrink: 0; cursor: pointer; }
        .thumbnail img { width: 120px; height: auto; border-radius: 4px; }
        .details strong { display: block; font-size: 1.1em; color: #333; }
        .details small { color: #666; display: block; margin-top: 5px; }
        h1, h2 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        .search-container { margin-bottom: 20px; }
        .initial-message { color: #888; text-align: center; padding: 50px; }
        .video-player { width: 100%; aspect-ratio: 16 / 9; margin-bottom: 20px; }
        .related-video .thumbnail img { width: 160px; }
    </style>
</head>
<body>
    <div class="search-container">
        <form action="/" method="GET">
            <input type="text" name="q" placeholder="検索キーワードを入力" value="${query || ''}" size="40" required>
            <button type="submit">🍊 検索</button>
        </form>
    </div>
`;

const HTML_FOOT = `
</body>
</html>
`;

function renderSearchHtml(query, results, error) {
    const resultsHtml = results.length > 0
        ? `
        <ul>
            ${results.map(item => `
                <li>
                    <a href="/watch?v=${item.videoId}" class="thumbnail">
                        <img src="${item.thumbnail}" alt="Thumbnail" loading="lazy">
                    </a>
                    <div class="details">
                        <a href="/watch?v=${item.videoId}">
                            <strong>${item.title}</strong>
                        </a>
                        <small>チャンネル: ${item.channel} | 再生時間: ${item.duration}</small>
                    </div>
                </li>
            `).join('')}
        </ul>`
        : (query ? `<p>「${query}」の検索結果は見つかりませんでした。</p>` : '');

    const initialMessage = !query && results.length === 0 && !error
        ? `
        <div class="initial-message">
            <h2>YouTube検索エンジン</h2>
            <p>キーワードを入力して、YouTube動画を検索してください。</p>
        </div>`
        : '';
        
    const errorDisplay = error ? `<p style="color: red;">${error}</p>` : '';

    return `
    ${HTML_HEAD("検索結果", query)}
    ${query ? `<h1>「${query}」の検索結果</h1>` : ''}
    ${errorDisplay}
    ${resultsHtml}
    ${initialMessage}
    ${HTML_FOOT}
    `;
}

function renderWatchHtml(videoTitle, videoId, relatedVideos) {
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
    const emptyQuery = '';

    const relatedHtml = relatedVideos.length > 0
        ? `
        <h2>関連動画</h2>
        <ul>
            ${relatedVideos.map(item => `
                <li class="related-video">
                    <a href="/watch?v=${item.videoId}" class="thumbnail">
                        <img src="${item.thumbnail}" alt="Related Thumbnail" loading="lazy">
                    </a>
                    <div class="details">
                        <a href="/watch?v=${item.videoId}">
                            <strong>${item.title}</strong>
                        </a>
                        <small>チャンネル: ${item.channel} | 再生時間: ${item.duration}</small>
                    </div>
                </li>
            `).join('')}
        </ul>`
        : `<p>関連動画は見つかりませんでした。</p>`;

    return `
    ${HTML_HEAD(videoTitle, emptyQuery)}
    <h1>${videoTitle}</h1>
    <iframe class="video-player" 
        src="${embedUrl}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
    </iframe>
    
    ${relatedHtml}
    
    <hr>
    <p><a href="/">← 新しい検索に戻る</a></p>

    ${HTML_FOOT}
    `;
}

// --- Express ルート定義 ---

app.get('/', async (req, res) => {
    const query = req.query.q ? req.query.q.trim() : ''; 
    let search_results = [];
    let error_message = null;

    if (query) {
        try {
            const search_data = await yt.search(query, { client: 'WEB' });
            
            search_results = search_data.videos
                .filter(video => video.title) 
                .slice(0, 10) 
                .map(video => {
                    const thumbnails = video.thumbnails || [];
                    const thumbnail_url = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';

                    return {
                        title: video.title,
                        videoId: video.id,
                        thumbnail: thumbnail_url, 
                        channel: video.author ? video.author.name : '不明なチャンネル',
                        duration: video.duration ? video.duration.text : '時間不明'
                    };
                });
            
        } catch (error) {
            console.error('youtubei.js Search error:', error);
            error_message = `検索中にエラーが発生しました。時間を置いて再度お試しください。`; 
        }
    }

    res.send(renderSearchHtml(query, search_results, error_message));
});

app.get('/watch', async (req, res) => {
    const videoId = req.query.v;
    if (!videoId) {
        return res.status(400).send('Video ID (v) が指定されていません。');
    }

    try {
        const info = await yt.getInfo(videoId);
        
        // エラー回避のための防御的チェック
        const basicDetails = info.basic_details;

        if (!basicDetails) {
            console.error(`Missing basic_details for video ${videoId}`);
            // basic_detailsがない場合、情報取得に失敗したとみなし404エラーを返す
            return res.status(404).send(`動画の情報が見つかりませんでした。Video ID: ${videoId}`);
        }

        const videoTitle = basicDetails.title || '動画タイトル不明'; 
        const relatedContent = info.related_content;
        let relatedVideos = [];

        if (relatedContent && relatedContent.contents) {
            relatedVideos = relatedContent.contents
                .filter(item => item.video_id) 
                .slice(0, 5) 
                .map(item => {
                    const thumbnails = item.thumbnails || [];
                    const thumbnail_url = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : ''; 
                    
                    return {
                        title: item.title?.text || 'タイトル不明',
                        videoId: item.video_id,
                        thumbnail: thumbnail_url,
                        channel: item.author?.name || '不明なチャンネル',
                        duration: item.duration?.text || '時間不明'
                    };
                });
        }
        
        res.send(renderWatchHtml(videoTitle, videoId, relatedVideos));

    } catch (error) {
        console.error(`Error fetching info for video ${videoId}:`, error);
        res.status(500).send(`動画の情報を取得できませんでした。`);
    }
});

// サーバー起動
initInnertube().then(() => {
    app.listen(PORT, () => {
        console.log(`Node.js Search Server running on port ${PORT}`); 
    });
}).catch(err => {
    console.error('Failed to initialize Innertube and start server:', err);
    process.exit(1);
});
