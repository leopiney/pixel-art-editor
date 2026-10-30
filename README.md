# Pixel Art Editor

A small local pixel art editor. Draw on a grid, undo a mistake, and export a PNG at the canvas resolution (one image pixel per cell).

## Run

```bash
npm start
```

Requires Node.js 18 or newer. There is nothing to install. The app opens at http://localhost:5173, or the next free port if that one is taken. Press Ctrl+C to stop it.

## Draw

- **Pencil (B)** paints with the current color. Click or drag.
- **Eraser (E)** clears pixels back to transparent.
- **Fill (G)** flood-fills the connected area you click.
- **Pick color (I)** copies the pixel under the cursor into the current color.

Choose a color from the palette or the color wheel. The grid can be hidden with the checkbox or `#`. **Clear canvas** wipes the drawing and can be undone.

## Canvas size

Enter a width and height from 1 to 128 and press Resize, or pick a square preset (8, 16, 32, 64). Pixels stay anchored to the top-left. Growing the canvas adds empty cells. Shrinking it crops. Resize is one undo step.

## Undo and redo

Each stroke, fill, clear, and resize is one step.

- Undo: Ctrl+Z or Cmd+Z, or the Undo button
- Redo: Ctrl+Shift+Z, Cmd+Shift+Z, Ctrl+Y, or the Redo button

## Export

Set a name (the default is `sprite`) and press **Export PNG**. The file downloads as `<name>-<width>x<height>.png`, for example `sprite-16x16.png`. The image is exactly the canvas size. Empty cells stay transparent, and the grid is not part of the file.
