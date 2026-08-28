export default async function handler(req, res) {
  const { code } = req.query;
  const CLIENT_KEY = "sbawb0xfwm83i7dzw2";
  const CLIENT_SECRET = "vICFuD4w4r2OI78mtTqcz45Um94KdzS1";
  const REDIRECT_URI = "https://sns-app-iota.vercel.app/api/tiktok-callback.js";

  if (!code) {
    return res.status(400).send("認可コードが受け取れませんでした。");
  }

  try {
    // 1. アクセストークンを取得
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

    if (!accessToken) {
      return res.status(400).send("トークン取得に失敗しました: " + JSON.stringify(tokenData));
    }

    // 2. TikTok APIからユーザー詳細・統計データ（フォロワー数・いいね数）を自動取得
    let statsParams = "open_id,union_id,avatar_url,display_name,follower_count,likes_count,video_count";
    const userRes = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${statsParams}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    const userData = await userRes.json();
    const userInfo = userData?.data?.user || {};

    const followers = userInfo.follower_count || 0;
    const likes = userInfo.likes_count || 0;
    const videos = userInfo.video_count || 0;
    const displayName = userInfo.display_name || "TikTok User";

    // 3. アプリ画面へ取得データを返却
    const redirectParams = new URLSearchParams({
      access_token: accessToken,
      username: displayName,
      followers: followers,
      likes: likes,
      videos: videos
    });

    res.writeHead(302, { Location: `/?${redirectParams.toString()}` });
    res.end();

  } catch (error) {
    res.status(500).send("通信エラー: " + error.message);
  }
}
