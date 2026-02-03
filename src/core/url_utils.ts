export function isYoutubeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be";
  } catch {
    return false;
  }
}

export function isGoogleAuthRedirect(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "accounts.google.com" || hostname.endsWith(".accounts.google.com");
  } catch {
    return false;
  }
}

export function containsGoogleAuthRedirect(text: string): boolean {
  const urlPattern = /https?:\/\/[^\s"\'<>]+/g;
  const urls = text.match(urlPattern) || [];
  return urls.some(isGoogleAuthRedirect);
}
