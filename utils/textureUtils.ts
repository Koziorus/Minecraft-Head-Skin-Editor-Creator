export const CANVAS_SIZE = 64;

// Initialize a skin with unique solid colors per face
export const createBaseSkin = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE); // Transparent background (important for overlay)

    const paintRect = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    };

    // --- Base Layer (Standard Steve layout) ---
    // Top [8, 0] - White
    paintRect(8, 0, 8, 8, '#FFFFFF');
    // Bottom [16, 0] - Grey
    paintRect(16, 0, 8, 8, '#808080');
    // Right [0, 8] - Green
    paintRect(0, 8, 8, 8, '#4CAF50');
    // Front [8, 8] - Red
    paintRect(8, 8, 8, 8, '#F44336');
    // Left [16, 8] - Yellow
    paintRect(16, 8, 8, 8, '#FFEB3B');
    // Back [24, 8] - Blue
    paintRect(24, 8, 8, 8, '#2196F3');

    // Overlay is left transparent by default (clearRect)
  }
  return canvas.toDataURL();
};

// Generates a small preview of the head (Front Face Base + Overlay)
export const getHeadPreviewFromCanvas = (sourceCanvas: HTMLCanvasElement): string => {
    const canvas = document.createElement('canvas');
    // 32x32 for a crisp thumbnail
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if(ctx) {
        ctx.imageSmoothingEnabled = false;
        // Draw Front Face Base: source x=8, y=8, w=8, h=8
        ctx.drawImage(sourceCanvas, 8, 8, 8, 8, 0, 0, 32, 32);
        // Draw Front Face Overlay: source x=40, y=8, w=8, h=8
        ctx.drawImage(sourceCanvas, 40, 8, 8, 8, 0, 0, 32, 32);
    }
    return canvas.toDataURL();
}

export const getCtxCoords = (uvX: number, uvY: number, width: number, height: number) => {
    const x = Math.floor(uvX * width);
    // Three.js UV (0,0) is bottom-left, Canvas (0,0) is top-left.
    // Minecraft textures are typically mapped such that we need to flip Y.
    const y = Math.floor((1 - uvY) * height);
    return { x, y };
};

// Map specific face indices of a BoxGeometry to Minecraft Skin UV areas
// Order of faces in Three.js BoxGeometry: Right, Left, Top, Bottom, Front, Back
export const HEAD_UVS = {
    base: [
        { face: 'right', u: [0, 8], v: [8, 16] },
        { face: 'left', u: [16, 24], v: [8, 16] },
        { face: 'top', u: [8, 16], v: [0, 8] },
        { face: 'bottom', u: [16, 24], v: [0, 8] },
        { face: 'front', u: [8, 16], v: [8, 16] },
        { face: 'back', u: [24, 32], v: [8, 16] },
    ],
    overlay: [
        { face: 'right', u: [32, 40], v: [8, 16] },
        { face: 'left', u: [48, 56], v: [8, 16] },
        { face: 'top', u: [40, 48], v: [0, 8] },
        { face: 'bottom', u: [48, 56], v: [0, 8] },
        { face: 'front', u: [40, 48], v: [8, 16] },
        { face: 'back', u: [56, 64], v: [8, 16] },
    ]
};