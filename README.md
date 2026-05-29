# Sprite Packer

A small browser-based sprite atlas builder. Select a folder of image files, choose the number of columns, and build a single PNG atlas preview.

## Run

Open `index.html` in a Chromium-based browser such as Edge or Chrome.

## Current Features

- Select a directory of images with the browser folder picker.
- Uses a dark three-panel layout with settings, atlas workspace, and preview/order panels.
- Supports light/dark mode, defaults to dark, and saves the selected theme locally.
- Supports PNG, JPG, GIF, WebP, BMP, and SVG files.
- Sorts files by folder-relative path with numeric ordering, so `tile2.png` comes before `tile10.png`.
- Packs images into a grid using majority, largest, or manual cell sizing.
- Handles oversized outliers by cropping, skipping, or expanding to the largest image.
- Can trim transparent edges before calculating cell size.
- Optional cell padding.
- Previews the generated atlas in a fixed-size window with vertical and horizontal scrollbars.
- Adjusts preview zoom with a bottom slider: center is 100%, left zooms out, right zooms in.
- Shows a yellow outline over the hovered atlas tile and displays it in an isolated inspector with a selectable background color.
- Pins a tile in the inspector with a normal click; hover preview still works and returns to the pinned tile when the mouse leaves.
- Shows an optional grid overlay with a selectable line color.
- Supports preview-only backgrounds: checker, solid color, dark, and light.
- Exports with either transparent pixels or a filled background color.
- Swaps atlas cells with Control-click: Control-click the first tile, then Control-click the second tile.
- Swaps atlas cells by dragging one tile onto another tile.
- Reorders sprites from the atlas order panel with drag-and-drop or Up/Dn buttons.
- Pins sprites from the atlas order panel by clicking a row.
- Removes sprites from the atlas order panel into a removed tray.
- Restores removed sprites from the tray back to the end of the atlas.
- Saves app settings locally in the browser and restores them when reopened.
- Downloads the generated atlas as `sprite-atlas.png`.

## Next Feature

Exporting atlas metadata as JSON.
