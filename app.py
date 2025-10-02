from flask import Flask, request, render_template_string
from youtubesearchpython import VideosSearch 
import os

# Flaskアプリケーションの初期化
app = Flask(__name__)

# シンプルなHTMLテンプレート
HTML_TEMPLATE = """
<!doctype html>
<title>🍊 yuzutube - 検索結果</title>
<style>
    body { font-family: sans-serif; max-width: 800px; margin: auto; padding: 20px; }
    ul { list-style: none; padding: 0; }
    li { border-bottom: 1px solid #eee; padding: 15px 0; }
    li a { text-decoration: none; color: #007bff; }
    li a:hover { text-decoration: underline; }
    small { color: #666; display: block; margin-top: 5px; }
    h1, h2 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
</style>

<h1>「{{ query or '...' }}」の検索結果</h1>
{% if results %}
    <ul>
    {% for item in results %}
        <li>
            <a href="{{ item.url }}" target="_blank">
                <strong>{{ item.title }}</strong>
            </a>
            <small>チャンネル: {{ item.channel }} | 再生時間: {{ item.duration }}</small>
        </li>
    {% endfor %}
    </ul>
{% else %}
    <p>検索キーワードを入力して、検索ボタンを押してください。</p>
{% endif %}

<hr>
<h2>新しい検索</h2>
<form action="/search" method="GET">
    <input type="text" name="q" placeholder="検索キーワードを入力" value="{{ query or '' }}" size="40">
    <button type="submit">🍊 検索</button>
</form>
"""

@app.route('/')
def index():
    """ルートパス ('/') で検索フォームを表示します。"""
    return render_template_string(HTML_TEMPLATE, query="", results=None)


@app.route('/search')
def search():
    """
    検索ルート: /search?q={query}
    URLのクエリパラメータ 'q' を使ってyoutube-searchを実行します。
    """
    # URLから 'q' パラメータの値（検索キーワード）を取得
    query = request.args.get('q', default='', type=str).strip()

    search_results = []
    
    if query:
        print(f"🍊 youtube-searchで '{query}' を検索中...")
        try:
            # 1. VideosSearchオブジェクトを作成し、検索を実行 (limit=10で上位10件)
            videosSearch = VideosSearch(query, limit=10) 
            results = videosSearch.result() # 検索結果を取得
            
            # 2. 検索結果をFlaskテンプレートに合う辞書形式に変換
            for item in results.get('result', []):
                search_results.append({
                    'title': item.get('title', 'タイトル不明'),
                    'url': item.get('link', '#'), # 'url'ではなく'link'を使用
                    'channel': item.get('channel', {}).get('name', 'チャンネル不明'),
                    'duration': item.get('duration', '時間不明'),
                })

        except Exception as e:
            # 検索中にエラーが発生した場合
            print(f"検索中にエラーが発生しました: {e}")
            search_results = []
    
    # 検索キーワードと結果をHTMLテンプレートに渡してレンダリング
    return render_template_string(
        HTML_TEMPLATE,
        query=query,
        results=search_results
    )

if __name__ == '__main__':
    # ローカル開発用にポート5000で実行します。
    port = int(os.environ.get("PORT", 5000))
    # Renderで実行されるgunicornとは異なり、開発環境ではデバッグモードを有効にします。
    app.run(host='0.0.0.0', port=port, debug=True)
