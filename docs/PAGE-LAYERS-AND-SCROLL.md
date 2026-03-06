# Page layout: layers, heights, and why you see scrolling

This describes the **main app** layout (e.g. `/en/businesslist`) as layers, how each height is determined, and why the page can scroll even when content is short.

---

## 1. Layout as layers (top to bottom)

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 0: Outer wrapper (main layout)                            │
│   div: min-h-screen w-full flex items-center justify-center      │
│   p-2 md:p-0 bg-black                                            │
│   → Height: min-height = 100vh (no max; can grow)                │
│   → No overflow set → can grow with content                      │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: PageContainer (the white card)                          │
│   div: max-w-[960px] flex flex-col min-h-0                        │
│   ALL:   h-[calc(100vh-1rem)] overflow-y-auto                   │
│   MD+:   md:mt-2 md:rounded-lg md:h-[calc(100vh-1rem)]          │
│   → Fixed height = viewport minus 1rem on all breakpoints       │
│   → Scroll only inside the white card; window never scrolls      │
└─────────────────────────────────────────────────────────────────┘
         │
         ├── PageHeader      (shrink-0, h-[60px])
         ├── PagesMenu       (shrink-0, h-[60px])
         ├── PageCategories  (shrink-0, min-h-[60px] h-[60px])
         ├── PageContent     (flex-1, p-2)  ← main content
         └── Footer          (mt-auto, h-[60px])
```

---

## 2. How each height is determined

| Layer / component   | Height / behavior | Why |
|----------------------|-------------------|-----|
| **Outer wrapper**    | `min-h-screen` only | Centers the white card; viewport-sized (card has fixed height, so wrapper doesn’t grow). |
| **PageContainer** (small) | `h-[calc(100vh-1rem)]` | White card is forced to viewport minus 1rem so it doesn’t overflow the screen; padding is the “1rem” gap. |
| **PageContainer** (md+) | `md:h-[calc(100vh-1rem)]` | Same as small: fixed height; scroll only inside the card. Window never scrolls. |
| **PageHeader**       | `min-h-[60px] h-[60px]` + `flex-shrink-0` | Fixed 60px so the header doesn’t shrink. |
| **PagesMenu**        | `h-[60px]` (inner div) + no shrink | Fixed 60px. |
| **PageCategories**   | `min-h-[60px] h-[60px]` + `flex-shrink-0` | Fixed 60px. |
| **PageContent**      | `flex-1` + no explicit height | Takes remaining space inside the flex column. Grows with children. |
| **Footer**           | `h-[60px]` + `mt-auto` | Fixed 60px; `mt-auto` pushes it to the bottom of the flex column. |

So on **small screens** the only thing with a fixed total height is **PageContainer** (`calc(100vh - 1rem)`). Everything inside is flex: header/menu/categories/footer have fixed heights; **PageContent** gets `flex-1` (remaining space).

---

## 3. Why you get scrolling even with little content

On **small screens** (default Tailwind, no `md:`):

1. **PageContainer** has a **fixed height**: `h-[calc(100vh-1rem)]`.
2. So the **total height of the scrollable area** is always (viewport − 1rem), regardless of content.
3. Inside that you have:
   - Header: 60px  
   - Menu: 60px  
   - Categories: 60px  
   - **PageContent**: `flex-1` (gets the rest)  
   - Footer: 60px  

4. **PageContent** has `flex-1`, so it gets **all remaining space** after the fixed sections. So:
   - Content height = `(100vh - 1rem) - 60 - 60 - 60 - 60` = viewport minus ~300px.
5. Even if the **actual content** (e.g. a few cards) is shorter than that, the **flex item** (PageContent) is still given that full remaining height (because of `flex-1`).
6. So the **total height of the content inside PageContainer** is:
   - 60 + 60 + 60 + (large flex-1 area) + 60 ≈ viewport size.
7. PageContainer also has **`overflow-y-auto`**, so it will show a scrollbar whenever **scrollHeight > clientHeight**. Because of flex and the way the content is laid out, the **inner content height** (scrollHeight) can still end up slightly **larger** than the container (clientHeight), e.g. due to:
   - padding (e.g. `p-2` on PageContent),
   - margins on children (e.g. `mt-6`, `mb-[60px]`),
   - rounding or min-height behavior (e.g. `min-h-full` on the BusinessListClient wrapper),

So you get **scrolling** even when the “visible content” (e.g. cards) doesn’t feel like it needs it: the **scrollable overflow** is coming from the fixed-height container plus the way flex and spacing add up inside it.

---

## 4. Summary

- **Layers**: Outer wrapper (min-h-screen) → PageContainer (white card) → Header, Menu, Categories, PageContent (flex-1), Footer.
- **Heights**: On small screens the only fixed “total” height is PageContainer `calc(100vh - 1rem)`. Header, menu, categories, footer are each 60px; PageContent gets the rest via `flex-1`.
- **Why scroll with little content**: PageContainer has a fixed height and `overflow-y-auto`. The flex layout + padding/margins/min-heights make the **inner content height** (scrollHeight) exceed the **container height** (clientHeight), so the container scrolls even when the main content (e.g. business list) is short.

To reduce or remove that extra scroll when content is short, you’d adjust the **main content** (and optionally the BusinessListClient wrapper) so the **total height of the flex children** doesn’t exceed the container—e.g. avoid `min-h-full` or large bottom margins when there are only a few items.
