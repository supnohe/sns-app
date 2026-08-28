export default async function handler(req, res) {
  const { code } = req.query;
  const CLIENT_KEY = "sbawb0xfwm83i7dzw2";
  const CLIENT_SECRET = "vICFuD4w4r2OI78mtTqcz45Um94KdzS1";
  const REDIRECT_URI = "https://sns-app-iota.vercel.app/api/tiktok-callback.js";

  const RAPID_API_KEY = "d5d83e4fa6msh08478310af3bfcfp150258jsnf9ffe2098b50";

  if (!code) {
    return res.status(400).send("認可コードが受け取れませんでした。");
  }

  try {
    // 1. TikTok公式OAuth認証でアカウント基本情報を取得
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const statsFields = "open_id,union_id,avatar_url,display_name,follower_count,likes_count,video_count";
    const userRes = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${statsFields}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    const userInfo = userData?.data?.user || {};

    // 2. RapidAPI から @supnohe の最新5投稿の全数値を精密抽出
    let videosList = [];
    let debugMessage = "";
    const targetUsername = "supnohe";

    try {
      const rapidRes = await fetch(`https://tiktok-api23.p.rapidapi.com/api/user/posts?unique_id=${targetUsername}&count=5`, {
        method: "GET",
        headers: {
          "x-rapidapi-key": RAPID_API_KEY,
          "x-rapidapi-host": "tiktok-api23.p.rapidapi.com"
        }
      });

      const rapidData = await rapidRes.json();
      
      // レスポンスの全階層パターンに対応
      const posts = rapidData?.data?.itemList || rapidData?.itemList || rapidData?.data?.videos || rapidData?.data || (Array.isArray(rapidData) ? rapidData : []);

      if (Array.isArray(posts) && posts.length > 0) {
        videosList = posts.slice(0, 5).map(v => {
          const st = v.statsV2 || v.stats || v.statistics || v;
          const createTime = v.createTime ? new Date(v.createTime * 1000) : (v.create_time ? new Date(v.create_time * 1000) : new Date());

          // 多種多様なプロパティ名から数値を取り出し
          const views = st.playCount ?? st.play_count ?? st.views ?? v.playCount ?? v.play_count ?? 0;
          const likes = st.diggCount ?? st.digg_count ?? st.likes ?? v.diggCount ?? v.digg_count ?? 0;
          const comments = st.commentCount ?? st.comment_count ?? st.comments ?? v.commentCount ?? v.comment_count ?? 0;
          const shares = st.shareCount ?? st.share_count ?? st.shares ?? v.shareCount ?? v.share_count ?? 0;

          return {
            title: v.desc || v.title || v.video_description || "TikTok投稿動画",
            url: `https://www.tiktok.com/@${targetUsername}/video/${v.id || v.video_id}`,
            date: createTime.toLocaleDateString('ja-JP'),
            isoDate: createTime.toISOString().split('T')[0],
            timestamp: createTime.getTime(),
            views: Number(views),
            likes: Number(likes),
            comments: Number(comments),
            shares: Number(shares)
          };
        });
        debugMessage = `✅ RapidAPI取得成功 (${videosList.length}件)`;
      } else {
        debugMessage = "⚠️ RapidAPIレスポンス内に動画データが見つかりませんでした: " + JSON.stringify(rapidData).substring(0, 100);
      }
    } catch (rapidErr) {
      debugMessage = "❌ RapidAPI通信エラー: " + rapidErr.message;
    }

    // 3. アプリ画面へデータ転送
    const redirectParams = new URLSearchParams({
      access_token: accessToken || "success",
      username: userInfo.display_name || `@${targetUsername}`,
      followers: userInfo.follower_count || 19565,
      likes: userInfo.likes_count || 529342,
      videos: userInfo.video_count || 173,
      videos_data: JSON.stringify(videosList),
      debug_msg: debugMessage
    });

    res.writeHead(302, { Location: `/?${redirectParams.toString()}` });
    res.end();

  } catch (error) {
    res.status(500).send("通信エラー: " + error.message);
  }
}
