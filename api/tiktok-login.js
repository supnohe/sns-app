export default function handler(req, res) {
  const CLIENT_KEY = "sbawb0xfwm83i7dzw2";
  const REDIRECT_URI = "https://sns-app-iota.vercel.app/api/tiktok-callback.js";
  
  // 🌟 権限（Scopes）をすべて指定
  const SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list";

  const csrfState = Math.random().toString(36).substring(2);
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}&scope=${encodeURIComponent(SCOPES)}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${csrfState}`;

  res.writeHead(302, { Location: authUrl });
  res.end();
}
