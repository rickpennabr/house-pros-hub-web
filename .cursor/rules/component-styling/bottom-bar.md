# Mobile Bottom Bar Rule

## Rule
**The mobile bottom bar is `BusinessListMobileBottomBar` (`components/pageslayout/BusinessListMobileBottomBar.tsx`). Any page that needs a mobile bottom menu uses it; never build another one.**

## Look
- Solid black bar, full width, five equal spots, a small white label under each icon (like Venmo).
- Side icons sit in a thin white square: `rounded-lg border-2 border-white`, 32px.
- The center button is the raised house: 48px square, `border-[5px] border-white`, black inside, raised over the bar, with the notification counter on its corner.
- House icons come from `HouseMark` (`components/icons/HouseMark.tsx`): red roof, white walls on the black bar (`tone="light"`). Variants: `plain` (person, center), `business` (briefcase, CRM), `plus` (Add).
- Bottom padding uses `env(safe-area-inset-bottom)` so labels clear the iPhone home bar.
- Mobile is card view only, so the bar has no view buttons. Settings lives in the profile menu.

## Spots by user
| | 1 | 2 | Center | 4 | 5 |
|---|---|---|---|---|---|
| Pro, business profile | Job cam | ProBot | Client portal | CRM | Add (CRM menu) |
| Pro, personal profile | Job cam | ProBot | My Places | Accounts | Add (customer menu) |
| Signed-in customer | Help | ProBot | My Places | Accounts | Add (customer menu) |
| Guest | Help | ProBot | My Places → sign up | Sign in | Estimate |

- The center house and Add follow the active profile (`useHomeShortcut` / `useBusinessProfileActive` in `HomeShortcutButton.tsx`).
- Guests tapping My Places go to `/signup?role=customer&returnUrl=/{locale}/myplaces`.
- Every label comes from the en/es/pt messages.
