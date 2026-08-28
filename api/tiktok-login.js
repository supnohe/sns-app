export default function handler(req, res) {
  const CLIENT_KEY = "sbawb0xfwm83i7dzw2";
  const REDIRECT_URI = "https://sns-app-iota.vercel.app/api/tiktok-callback.js";

  // 追加した権限（user.info.basic, user.info.stats, video.list）を明示的に要求
  const SCOPE = "user.info.basic,user.info.stats,video.list";
  const STATE = "tiktok_auth_state";

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?` +
    `client_key=${CLIENT_KEY}` +
    `&scope=${encodeURIComponent(SCOPE)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${STATE}`;

  res.redirect(authUrl);
}
