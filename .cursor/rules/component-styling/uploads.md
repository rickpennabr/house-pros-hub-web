# Uploads: drag and drop everywhere

Every place a user uploads a file accepts drag and drop, using one of two components.

## A plain upload box: `FileDropZone`

`components/ui/FileDropZone.tsx`

```tsx
<FileDropZone
  onFiles={(files) => upload(files)}
  accept=".pdf,image/jpeg,image/png,image/webp"
  multiple
  maxSizeMb={20}
  hint="PDF, JPEG, PNG or WebP · up to 20 MB"
  error={uploadError}
/>
```

- Dashed box with a cloud icon; "Drag files here or browse"; red outline and "Drop to upload" while dragging.
- Click, Enter or Space opens the picker. Files that fail `accept` or `maxSizeMb` get a message and are not passed on.
- `compact` for tight spots; `label` to show a chosen file name or "Uploading…".
- Do not put it inside a `<label>`: the label would open the picker twice.

## A tile or button that already opens a picker: `FileDropTarget`

`components/ui/FileDropTarget.tsx`

```tsx
<FileDropTarget inputRef={logoInputRef}>
  <div onClick={() => logoInputRef.current?.click()} className="w-24 h-24 ...">…</div>
</FileDropTarget>
```

- Keeps the tile's look; shows a dashed red "Drop" overlay while dragging.
- With `inputRef`, dropped files go into that input and its `onChange` runs, so resize, crop, validation and upload code is shared with picking. A `<label>` that wraps its own `<input type="file">` needs no ref.
- Or pass `onFiles` to handle the files directly.
- The wrapper is a `relative` block. For an absolutely positioned tile pass `className="absolute inset-0"`; for a flex child pass the tile's flex classes (`shrink-0`, `flex-1`).
- Nested targets (a logo on a banner) work: the inner one takes the drop.

For custom layouts use the hook behind both: `useFileDrop` (`hooks/useFileDrop.ts`).
