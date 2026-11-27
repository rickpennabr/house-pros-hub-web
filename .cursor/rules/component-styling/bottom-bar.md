# Mobile Bottom Bar Rule

## Rule
**The mobile bottom bar is `BusinessListMobileBottomBar` (`components/pageslayout/BusinessListMobileBottomBar.tsx`). Any page that needs a mobile bottom menu uses it; never build another one.**

## Look
- Solid black bar, full width, five equal spots, a small white label under each icon (like Venmo).
- Side icons sit in a thin outlined square: `rounded-lg border-2 border-white` (open on the bar).
- The center button is the raised house: 53px black square (`rounded-lg bg-black`), sitting in a rounded notch so the bar rises as a black tab around it. The gap between that tab and the house is solid white, never a see-through hole. The notification counter sits on its corner.
- House icons use `HouseMark` with `tone="light"` (white walls on the black bar), including the center house. Variants: `plain` (person, center), `business` (briefcase, CRM), `plus` (Add), `gear` (Accounts).
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
