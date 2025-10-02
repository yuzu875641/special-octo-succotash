import { Innertube } from 'youtubei.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ESモジュールのファイルパス設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

let yt;

// Innertubeクライアントの初期化
async function initInnertube() {
    yt = await Innertube.create();
    console.log('Innertube Client Initialized. 🍊');
}

// メインルート: 検索フォームと結果の表示を処理
app.get('/', async (req, res) => {
    const query = req.query.q ? req.query.q.trim() : '';
    let search_results = [];
    let error_message = null;

    if (query) {
        console.log(`[SEARCH] Query: ${query}`);
        try {
            const search_data = await yt.search(query, { client: 'WEB' });

            // 動画結果のみに絞り込み、情報が欠落している結果（undefinedなど）を除外
            search_results = search_data.videos
                // ★ フィルタリング処理: タイトルが存在する結果のみを抽出
                .filter(video => video.title) 
                .slice(0, 10) 
                .map(video => {
                    // サムネイルは最高画質のもの（リストの末尾）を取得
                    const thumbnails = video.thumbnails || [];
                    const thumbnail_url = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';

                    return {
                        title: video.title,
                        thumbnail: thumbnail_url, 
                        channel: video.author ? video.author.name : '不明なチャンネル',
                        duration: video.duration ? video.duration.text : '時間不明'
                    };
                });
            
        } catch (error) {
            console.error('youtubei.js Search error:', error);
            error_message = `検索中にエラーが発生しました。`;
        }
    }

    // HTMLをレンダリングしてクライアントに返却
    res.send(renderHtml(query, search_results, error_message));
});


// HTML テンプレート生成関数
function renderHtml(query, results, error) {
    // 検索結果のHTMLフラグメントを生成
    const resultsHtml = results.length > 0
        ? `
        <ul>
            ${results.map(item => `
                <li>
                    <div class="thumbnail">
                        <img src="${item.thumbnail}" alt="Thumbnail" loading="lazy">
                    </div>
                    <div class="details">
                        <strong>${item.title}</strong>
                        <small>チャンネル: ${item.channel} | 再生時間: ${item.duration}</small>
                    </div>
                </li>
            `).join('')}
        </ul>`
        : (query ? `<p>「${query}」の検索結果は見つかりませんでした。</p>` : '');

    // 検索ワードがない場合の初期画面メッセージを生成
    const initialMessage = !query && results.length === 0 && !error
        ? `
        <div class="initial-message">
            <h2>YouTube検索エンジン</h2>
            <p>キーワードを入力して、YouTube動画を検索してください。</p>
        </div>`
        : '';
        
    const errorDisplay = error ? `<p style="color: red;">${error}</p>` : '';

    return `
<!doctype html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>🍊 yuzutube - 検索エンジン (Node.js/youtube.js)</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: auto; padding: 20px; }
        ul { list-style: none; padding: 0; }
        li { border-bottom: 1px solid #eee; padding: 15px 0; display: flex; align-items: flex-start; }
        .thumbnail { margin-right: 15px; flex-shrink: 0; }
        .thumbnail img { width: 120px; height: auto; border-radius: 4px; }
        .details strong { display: block; font-size: 1.1em; color: #333; }
        .details small { color: #666; display: block; margin-top: 5px; }
        h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        .search-container { margin-bottom: 20px; }
        .initial-message { color: #888; text-align: center; padding: 50px; }
    </style>
</head>
<body>
    <div class="search-container">
        <form action="/" method="GET">
            <input type="text" name="q" placeholder="検索キーワードを入力" value="${query}" size="40" required>
            <button type="submit">🍊 検索</button>
        </form>
    </div>

    ${query ? `<h1>「${query}」の検索結果</h1>` : ''}
    
    ${errorDisplay}
    ${resultsHtml}
    ${initialMessage}
</body>
</html>
    `;
}

// サーバー起動
initInnertube().then(() => {
    app.listen(PORT, () => {
        console.log(`Node.js Search Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize Innertube and start server:', err);
    process.exit(1);
});
