# ProBot Explainer Series — Maintenance Agreements

Three short videos (45–75 s each). ProBot narrates while the live product UI plays. Locale: `/en`.
Base URL placeholder: `{BASE}` (local dev: `http://localhost:3000`).

**Shared demo data (set up once before recording)**
- Pro account with CRM access, business profile filled in, Stripe in **test mode**.
- CRM customer **"Jordan Rivera"** whose email you can open (a test inbox you control).
- Jordan signs in to the hub with that same email and has a place added in My Places, e.g. "Rivera Home".
- Line item: "Monthly pool & paver care", qty 1, $180.00.
- Deposit: $90.00 (50% button). Visit schedule: **Every month**.

**Shared /public packing list (all three videos)**

| File | Use |
|---|---|
| `pro-bot-solo.gif` (4.7 MB) | Main narrator loop, docked bottom-left/right |
| `pro-bot-solo.png` | Freeze frame, end cards, thumbnails |
| `pro-bot-solo-typing-new.gif` | When the UI is filling in a form / "working" beats |
| `pro-bot-solo-typing.gif` | Lighter typing alternative (650 KB) |
| `pro-bot-typing.png` / `hph-pro-bot-typing-static.png` | Static typing pose for stills |
| `hph-hub-agent-welcome.gif` | Opening wave / intro beat |
| `dance.gif` / `dance-1.gif` | Celebration beat (signed, paid, plan started) |
| `hph-logo-with-pro-bot-wt.png` | Intro / outro logo lockup (light bg) |
| `house-pros-hub-logo-simble-bot-v2-white.png` | Logo bug on dark backgrounds |
| `house-pros-hub-logo-simble-bot-v2.png` | Logo bug on light backgrounds |
| `hph-logo-with-pro-bot-mobile.png` | Vertical (9:16) cut end card |

Do not use `hph-hub-agent-welcome-japa.gif` (alternate-locale variant) or `pro-bot-typing-creating-account.gif` (signup context) in this series.

**Speech bubble style:** white bubble, 3 px black border, rounded 12 px, black bold text, max ~6 words, tail toward ProBot. Matches the app's black-border card style.

---

## Video 1 — Pro: create & send a Maintenance agreement (~60 s)

### 1) Voiceover (ProBot)
> Hi! I'm ProBot. Let's turn a one-time job into steady work.
> Open your CRM. Go to Estimates. Tap New estimate.
> Pick your customer. Jordan's already here.
> Now the magic part. Set Agreement to Maintenance agreement.
> Choose a visit schedule. We'll go every month.
> Add a job area, like Pavers or Pool.
> Add your line item. Monthly pool and paver care. One-eighty.
> Want a deposit? Tap fifty percent. Done.
> Save it. Then Review and Send.
> Check the customer preview. That's exactly what Jordan sees.
> Add a short note. Hit Send email.
> That's it. Jordan gets a secure link to sign. I'll take it from here!

### 2) Shot list
| # | Time | URL / action | Notes |
|---|---|---|---|
| 1 | 0:00–0:04 | Logo card | `hph-logo-with-pro-bot-wt.png` + `hph-hub-agent-welcome.gif` |
| 2 | 0:04–0:09 | `{BASE}/en/crm/estimates` | Signed in as the pro; list of estimates visible |
| 3 | 0:09–0:13 | Click **New estimate** | Form opens |
| 4 | 0:13–0:18 | **Customer** select → "Jordan Rivera" | |
| 5 | 0:18–0:24 | **Agreement** select → "Maintenance agreement" | Zoom in; the **Visit schedule** row appears |
| 6 | 0:24–0:29 | **Visit schedule** → "Every month" | |
| 7 | 0:29–0:33 | **Job area** → type `Pavers` | |
| 8 | 0:33–0:40 | Line item: description "Monthly pool & paver care", qty 1, rate 180 | Switch ProBot to typing gif |
| 9 | 0:40–0:44 | Totals panel → click **50%** next to Deposit | Shows $90.00 |
| 10 | 0:44–0:48 | Click **Create** / save, then **Review & Send** | |
| 11 | 0:48–0:54 | Send dialog — preview step | Header reads **MAINTENANCE AGREEMENT**; amber "Customer preview" bar |
| 12 | 0:54–0:59 | Continue → compose step → type note → **Send email** | |
| 13 | 0:59–1:03 | Toast: "Estimate sent to …" | Blur the email address in edit |
| 14 | 1:03–1:08 | End card | `dance.gif` + logo |

### 3) Speech bubbles
1. "Hi! I'm ProBot 👋"
2. "CRM → Estimates"
3. "Pick your customer"
4. "Agreement: Maintenance"
5. "Every month. Easy."
6. "Add what's included"
7. "50% deposit? One tap."
8. "Preview what they see"
9. "Send!"
10. "Steady work, unlocked"

### 4) CapCut captions
```
Hi! I'm ProBot.
Let's turn one job into steady work.
Open CRM → Estimates.
Tap New estimate.
Pick your customer.
Set Agreement to Maintenance.
Choose the visit schedule.
Every month works great.
Add a job area.
Add your line item.
Tap 50% for the deposit.
Save, then Review & Send.
This is exactly what your customer sees.
Add a note. Send email.
Your customer gets a secure link to sign.
```

### 5) Packing list
`hph-logo-with-pro-bot-wt.png`, `hph-hub-agent-welcome.gif`, `pro-bot-solo.gif`, `pro-bot-solo-typing-new.gif`, `dance.gif`, `house-pros-hub-logo-simble-bot-v2.png`

---

## Video 2 — Customer: sign from email / Present on device / My Places (~70 s)

### 1) Voiceover (ProBot)
> Your customer has three easy ways to sign. Let me show you.
> Way one: the email. Jordan taps the link.
> The agreement opens. Maintenance, every month. Clear price. Clear deposit.
> Jordan types their full name. Taps Sign and approve. Signed!
> Way two: you're right there in person.
> Open the estimate. Tap Present on device.
> Hand over your tablet. Jordan reviews, signs, and approves. No email needed.
> Way three: My Places.
> Jordan signs in to House Pros Hub. Opens My Places.
> Picks their home. Taps Open and sign.
> Every way lands in the same spot. Signed, saved, and on the timeline.

### 2) Shot list
| # | Time | URL / action | Notes |
|---|---|---|---|
| 1 | 0:00–0:04 | Title card "3 ways to sign" | `pro-bot-solo.gif` |
| 2 | 0:04–0:10 | Test inbox → email from the pro → click link | Mask inbox chrome |
| 3 | 0:10–0:18 | `{BASE}/en/estimates/view?token=…` | Header **MAINTENANCE AGREEMENT**, total, deposit, schedule |
| 4 | 0:18–0:25 | Scroll to sign → "Type your full name to sign" → `Jordan Rivera` → **Sign & approve** | Message "Estimate approved…" — **stop before Pay now** |
| 5 | 0:25–0:29 | Card: "Way 2 — in person" | |
| 6 | 0:29–0:34 | `{BASE}/en/crm/estimates` → row **⋮** menu → **Present on device** (or open estimate → **Present on device** button) | Use a *second* unsigned estimate |
| 7 | 0:34–0:44 | New tab `…/en/estimates/view?token=…&present=1` | Black bar: "Hand this device to the customer…". Optionally record at tablet size (768×1024) |
| 8 | 0:44–0:48 | Type name → **Sign & approve** | `dance-1.gif` |
| 9 | 0:48–0:52 | Card: "Way 3 — My Places" | |
| 10 | 0:52–0:57 | `{BASE}/en/myplaces` signed in as the customer | Place cards |
| 11 | 0:57–1:04 | Click "Rivera Home" → `/en/myplaces/{id}` → **Estimates** tab | Row shows "· Maintenance · Deposit due $90.00" |
| 12 | 1:04–1:10 | **Open & sign** → name → **Sign & approve** | Use a *third* unsigned estimate; message "Agreement signed. Thank you." |
| 13 | 1:10–1:14 | **Timeline** tab | Signed event visible; end card |

### 3) Speech bubbles
1. "3 ways to sign ✍️"
2. "Way 1: the email"
3. "Clear price. Clear deposit."
4. "Type name → Sign!"
5. "Way 2: in person"
6. "Present on device"
7. "Hand it over"
8. "Way 3: My Places"
9. "Open & sign"
10. "All on the timeline"

### 4) CapCut captions
```
Three easy ways to sign.
Way 1: the email link.
The agreement opens right away.
Maintenance. Every month. Clear price.
Type your full name.
Tap Sign & approve.
Way 2: you're there in person.
Tap Present on device.
Hand over the tablet.
Your customer signs on the spot.
Way 3: My Places.
Open your home. Tap Open & sign.
Every way ends signed and saved.
```

### 5) Packing list
`pro-bot-solo.gif`, `pro-bot-solo-typing.gif`, `dance-1.gif`, `pro-bot-solo.png`, `house-pros-hub-logo-simble-bot-v2.png`, `hph-logo-with-pro-bot-mobile.png` (vertical cut)

---

## Video 3 — After sign: deposit + maintenance plan on My Places + CRM portal (~60 s)

### 1) Voiceover (ProBot)
> Jordan signed. So what happens next? A lot. Automatically.
> First, the deposit. A deposit invoice is ready right away.
> Jordan taps Pay now and pays by card.
> Next, the maintenance plan. It starts on its own.
> In My Places, open the home. Tap Maintenance.
> There it is. Every month. With the next visit date.
> Invoices, documents, and the timeline. All in one place.
> Now the pro side. Open the CRM portal.
> Same customer. Same place. Same plan.
> You manage it here. They see it there. Nobody chases paperwork.
> Sign once. Get paid. Show up every month. That's the House Pros Hub way!

### 2) Shot list
| # | Time | URL / action | Notes |
|---|---|---|---|
| 1 | 0:00–0:04 | Signed agreement screen ("Signed & approved") | `dance.gif` |
| 2 | 0:04–0:12 | Same page → "Payment is ready. Pay by card to start the work." → hover **Pay now** | **Test mode only.** Use Stripe test card `4242 4242 4242 4242`, or cut before submitting |
| 3 | 0:12–0:18 | `{BASE}/en/crm/invoices` (pro) | Deposit invoice for $90.00 listed |
| 4 | 0:18–0:24 | `{BASE}/en/myplaces/{id}` (customer) → **Maintenance** tab | Plan with "Every month" and **Next visit** date |
| 5 | 0:24–0:30 | **Invoices** tab → **Documents** tab | |
| 6 | 0:30–0:36 | **Timeline** tab | Added → Received → Approved → Paid |
| 7 | 0:36–0:40 | `{BASE}/en/crm/invoices/recurring` (pro) | Monthly visit invoice schedule (only when the visit amount is above 0 and the cadence is weekly, biweekly, monthly or yearly; quarterly has none) |
| 8 | 0:40–0:50 | `{BASE}/en/crm/portal` → Jordan Rivera | "Projects on their place", **Maintenance** section, published documents |
| 9 | 0:50–0:58 | Split screen: CRM portal (left) vs My Places Maintenance tab (right) | |
| 10 | 0:58–1:04 | End card | `dance-1.gif` + `hph-logo-with-pro-bot-wt.png` |

### 3) Speech bubbles
1. "Signed! Now what? 🤔"
2. "Deposit: ready"
3. "Pay now 💳"
4. "Plan starts itself"
5. "Every month, on schedule"
6. "All in one timeline"
7. "Pro side: CRM portal"
8. "Same plan, both sides"
9. "Sign. Pay. Show up."

### 4) CapCut captions
```
Signed! Now what?
The deposit invoice is ready right away.
Tap Pay now. Pay by card.
The maintenance plan starts by itself.
My Places → your home → Maintenance.
Every month, with the next visit date.
Invoices, documents, timeline. One place.
Pro side: open the CRM portal.
Same customer. Same plan.
You manage it. They see it.
Sign once. Get paid. Show up every month.
```

### 5) Packing list
`dance.gif`, `dance-1.gif`, `pro-bot-solo.gif`, `pro-bot-solo-typing-new.gif`, `hph-logo-with-pro-bot-wt.png`, `house-pros-hub-logo-simble-bot-v2-white.png` (for dark split-screen divider)

---

## Recording notes
- Use **three unsigned maintenance estimates** for Video 2 (email, present, My Places), because each one can be signed only once.
- Blur emails, tokens in URLs, and Stripe IDs in the edit.
- No real payments. Use Stripe test mode only, or cut at **Pay now**.
- Export at 1920×1080. Make a 1080×1920 cut with the ProBot dock moved to bottom-center.
