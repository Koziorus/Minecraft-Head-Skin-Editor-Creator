export const fetchSkinFromUsername = async (username: string): Promise<string | null> => {
  try {
    // Ashcon API is a reliable CORS-friendly proxy for Mojang data
    const response = await fetch(`https://api.ashcon.app/mojang/v2/user/${username}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.textures.skin.data; // This is the base64 string
  } catch (error) {
    console.error("Failed to fetch skin", error);
    return null;
  }
};

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};