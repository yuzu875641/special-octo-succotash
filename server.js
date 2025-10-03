import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import YouTube from 'youtube-sr'; // youtube-srをインポート

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000; 

// youtube-srはインスタンス化が不要なため、yt変数は不要

// --- ユーティリティ関数（youtube-sr用に調整） ---

// durationSecを "MM:SS" 形式に変換するヘルパー関数
function formatDuration(durationSec) {
    if (!durationSec || isNaN(durationSec)) return '時間不明';
    const totalSeconds = Number(durationSec);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(String(hours));
    parts.push(String(minutes).padStart(hours > 0 ? 2 : 1, '0'));
    parts.push(String(seconds).padStart(2, '0'));
    
    return parts.join(':');
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

// ルート: 検索
app.get('/', async (req, res) => {
    const query = req.query.q ? req.query.q.trim() : ''; 
    let search_results = [];
    let error_message = null;

    if (query) {
        try {
            // 修正: YouTube.searchを使用
            const search_data = await YouTube.search(query, {
                limit: 10,
                type: 'video' // 動画のみに限定
            });
            
            search_results = search_data
                .filter(video => video.title) 
                .map(video => {
                    const thumbnails = video.thumbnails || [];
                    const thumbnailUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';

                    return {
                        title: video.title,
                        videoId: video.id,
                        thumbnail: thumbnailUrl, 
                        channel: video.channel ? video.channel.name : '不明なチャンネル',
                        duration: formatDuration(video.durationSec)
                    };
                });
            
        } catch (error) {
            console.error('youtube-sr Search error:', error);
            error_message = `検索中にエラーが発生しました。時間を置いて再度お試しください。`; 
        }
    }

    res.send(renderSearchHtml(query, search_results, error_message));
});

// ルート: 動画再生ページ
app.get('/watch', async (req, res) => {
    const videoId = req.query.v;
    if (!videoId) {
        return res.status(400).send('Video ID (v) が指定されていません。');
    }

    try {
        // 修正: YouTube.getVideo()で動画の詳細情報を取得
        const video = await YouTube.getVideo(`https://www.youtube.com/watch?v=${videoId}`);
        
        if (!video || !video.title) {
            console.error(`Missing details for video ${videoId} via youtube-sr`);
            return res.status(404).send(`動画の情報が見つかりませんでした。Video ID: ${videoId}`);
        }

        const videoTitle = video.title;
        
        // youtube-srは関連動画を直接提供しないため、動画タイトルを使って検索することで代替する
        let relatedVideos = [];
        try {
            const relatedSearch = await YouTube.search(videoTitle, {
                limit: 6, // 検索結果から自分自身を除外する可能性があるため、少し多めに取得
                type: 'video'
            });

            relatedVideos = relatedSearch
                .filter(item => item.id !== videoId && item.title) // 自分自身とタイトルがないものを除外
                .slice(0, 5) 
                .map(item => {
                    const thumbnails = item.thumbnails || [];
                    const thumbnailUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';
                    
                    return {
                        title: item.title,
                        videoId: item.id,
                        thumbnail: thumbnailUrl,
                        channel: item.channel ? item.channel.name : '不明なチャンネル',
                        duration: formatDuration(item.durationSec)
                    };
                });
        } catch (relatedError) {
            console.error('youtube-sr Related Search error:', relatedError);
            // 関連動画の取得に失敗してもメイン動画の再生は続ける
        }
        
        res.send(renderWatchHtml(videoTitle, videoId, relatedVideos));

    } catch (error) {
        console.error(`Error fetching info for video ${videoId}:`, error);
        // "動画が見つからない"エラーの場合もあるため、404を返す
        res.status(404).send(`動画の情報を取得できませんでした。Video ID: ${videoId}`);
    }
});

// サーバー起動
// youtube-srはインスタンス化不要のため、initInnertubeを削除し、直接起動
app.listen(PORT, () => {
    console.log(`Node.js Search Server running on port ${PORT}`); 
});
