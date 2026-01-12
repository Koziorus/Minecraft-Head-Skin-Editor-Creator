<div align="center">
<img alt="Screenshot" src="Screenshot 2026-01-12 220048.png" />
</div>

# Minecraft Head Skin Editor & Creator

Create, import, edit, and export Minecraft player head textures with a 3D/2D workspace and a branching timeline that supports Ctrl+Z / Ctrl+Y. Build heads from scratch or start from any player name, base64 texture, or uploaded PNG.

## Features
- 3D, 2D, and split views with live sync between canvases (head-only map with overlay guides)
- Branching timeline tree with thumbnails or 3D previews; jump between steps and prune future branches
- Undo / redo via toolbar or keyboard (Ctrl+Z / Ctrl+Y, or Ctrl+Shift+Z for redo)
- Tools: brush, eraser/restore from original, color picker, recent color swatches, adjustable brush size
- Layer-aware painting with base vs overlay selection and overlay visibility toggle
- Import options: player username (fetch), raw base64, data URL, or PNG upload
- Export options: PNG download, base64 texture, and ready-to-paste `/give` player head command
- Hotkeys: Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl+Shift+Z (redo); right-click drag to orbit 3D, middle-click drag to pan
- Context menu on timeline nodes to prune future steps and tidy history branches

## Controls & Shortcuts
- 3D view: right-click drag to rotate; middle-click drag to pan
- 2D view: left-click/drag to paint; guides mark each head face and overlay sections
- Timeline: click a node to jump; right-click a node for pruning
- Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y redo, Ctrl/Cmd+Shift+Z redo

## Import / Export
- Import a player name, base64 string, data URL, or upload a PNG
- Export as PNG, copy base64, or copy the `/give @p minecraft:player_head ...` command

## Run Locally
**Prerequisite:** Node.js

```bash
npm install
npm run dev
```
