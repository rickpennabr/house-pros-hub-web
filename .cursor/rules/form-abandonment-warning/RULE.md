---
description: "Show warning modal when leaving multi-step or ProBot forms after user has entered data"
globs: ["**/components/chat/**", "**/components/probot/**", "**/*Form*.tsx", "**/crm/**/page.tsx"]
alwaysApply: false
---

# Form Abandonment Warning

When a user is partway through a multi-step or conversational form and tries to leave (close, go back, navigate home), show a **warning modal** so they don’t lose data by accident.

## When to show the modal

### ProBot / chat flows (sign up, add customer, estimate, etc.)

- **Trigger**: User is on the **third question/step or later** (step index ≥ 2).
- **Actions that must trigger the warning**:
  - Closing the chat/drawer or dialog.
  - Clicking “Back” to leave the flow (e.g. back to choice screen or home).
  - Browser back button or navigation that would leave the form.
  - Escape key if it closes the form.
- **Do not** show the modal on step 0 or 1; allow leaving without warning.

### Regular (non-ProBot) multi-step forms

- **Trigger**: User has passed the **second step** (step index &gt; 1, i.e. on step 2 or later).
- **Actions that must trigger the warning**:
  - Closing the form or modal.
  - Navigating away (e.g. back to list, home, or another route).
  - Browser/tab close or refresh: use `beforeunload` so the browser can show its own “Leave site?” prompt when appropriate.

## Modal content and behavior

- **Message**: Clearly state that **data entered will be lost** (and that they’ll need to start over if they leave).
- **Actions**:
  - **Cancel / Stay**: Close the modal and keep the user on the form.
  - **Confirm / Leave**: Close the modal and perform the leave action (close drawer, go back, navigate, etc.).
- Use existing i18n where it fits (e.g. `auth.signup.chat.closeWarningTitle`, `closeWarningMessage`, `closeWarningCancel`, `closeWarningConfirm`). For add-customer or other flows, add flow-specific keys if the copy should differ (e.g. “Leave add customer?” / “Your progress will be lost…”).

## Implementation notes

- **ProBot / drawer**: See `BotChatDrawer.tsx`: `showLeaveSignupModal` is set when `signupStepIndex >= 3` (third step) on close; use the same pattern for add-customer and other ProBot flows (e.g. pass step index from form to parent and show modal when step ≥ 2 and user tries to close or go back).
- **Back button inside form**: When user clicks “Back” and would leave the flow (e.g. first step “Back to choices”), show the same warning if current step ≥ 2.
- **Regular forms**: In multi-step form components or their parent (e.g. CRM customer form, estimate form), intercept close/back/navigation when `stepIndex > 1` and show the same style of modal before actually closing or navigating.
- **beforeunload**: For page/tab close or refresh, add a `beforeunload` listener when the user is past step 1 and the form has unsaved data; remove the listener on submit or when the user safely leaves after confirming.

## Checklist for new or updated forms

- [ ] ProBot/chat flow: warning shown when step ≥ 2 and user closes drawer, goes back to choice, or uses Escape to exit.
- [ ] Regular multi-step form: warning shown when step &gt; 1 and user closes form or navigates away.
- [ ] Modal copy states that data will be lost (and start over if applicable).
- [ ] Cancel keeps user on the form; Confirm performs the leave action.
- [ ] i18n keys used (en + es) for title, message, and buttons.
