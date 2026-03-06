# Getting Notifications on iPhone (House Pros Hub)

To get **banner notifications** (pop-ups at the top of the screen) and the **red badge** on the House Pros Hub app icon—similar to WhatsApp—you need to install the app from Safari and turn on notifications.

## 1. Add House Pros Hub to your Home Screen

House Pros Hub is a **Progressive Web App (PWA)**. On iPhone it must be added from **Safari** (not Chrome or other browsers).

1. Open **Safari** and go to your House Pros Hub site (e.g. `https://houseproshub.com` or your staging URL).
2. Tap the **Share** button (square with arrow) at the bottom.
3. Scroll and tap **“Add to Home Screen”**.
4. Edit the name if you like, then tap **Add**.

You should now see the House Pros Hub icon on your home screen (e.g. the white icon with the red roof and “HPH”).

## 2. Allow notifications

1. Open House Pros Hub **from the home screen icon** (not from Safari).
2. When the app asks to send you notifications, tap **Allow**.
3. If you don’t see a prompt:
   - **Visitors:** Open ProBot chat (floating button), start or open a conversation, and look for an option to enable notifications.
   - **Contractors:** Go to **ProBot** and enable the bell for “push when visitors message.”
   - **Admins:** Go to **Admin → Chat** and enable push there if offered.

After you allow notifications, the app can:

- Show **banner notifications** at the top when you get a new message (like WhatsApp).
- Show a **red badge** on the app icon with the number of unread messages (capped at 99).

## 3. Requirements

- **iOS 16.4 or later** (needed for web push on PWAs).
- The app **must be opened from the home screen** at least once and notifications must be allowed from that PWA context.
- Notifications only work when the app was **added to the home screen from Safari** on the same device.

## 4. If you don’t see banners or the badge

- Confirm **Settings → Notifications → House Pros Hub** (or “HPH”) has **Allow Notifications** on and **Lock Screen**, **Notification Center**, and **Banners** are enabled as you prefer.
- Open the app from the **home screen** again and trigger the “Enable notifications” flow (ProBot for visitors/contractors, Admin Chat for admins) so the push subscription is created.
- If you added the app a long time ago, remove it from the home screen and **Add to Home Screen** again from Safari, then allow notifications when prompted.

Once set up, new messages will trigger a banner at the top and update the red number on the app icon; opening the app and reading messages will clear the badge.
