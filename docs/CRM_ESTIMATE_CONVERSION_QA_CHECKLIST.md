# CRM Estimate Conversion QA Checklist

## Setup
- Seed one contractor account with at least one customer.
- Create 3 estimates for same customer: one `draft`, one `sent`, one `accepted`.

## Estimate Form Parity
- Open `CRM > Estimates > New Estimate`.
- Confirm document-style layout, line item table, reusable product/service picker, unit picker, total section, and sticky action bar render correctly.
- Create estimate using line items only and confirm server computes `amount_cents` from line items.
- Edit estimate and verify line item updates recalculate amount and persist.

## Estimate -> Invoice Conversion
- From an `accepted` estimate, run `Convert to invoice`; confirm redirect to created invoice detail page.
- Retry conversion on same estimate; verify API returns conflict and UI shows an error.
- Attempt conversion on `draft` or `sent`; verify conversion action is unavailable or server rejects with `{ error: string }`.
- Verify converted invoice has `estimate_id` set and conversion metadata (`converted_from_estimate_at`, `converted_from_estimate_by`) populated.

## Estimate -> Project Conversion
- From an `accepted` estimate, run `Convert to project`; confirm new project appears in `CRM > Projects`.
- Verify created project links `estimate_id`, uses same `customer_id`, and defaults status to `planned`.
- Retry conversion on same estimate; verify duplicate prevention error.

## Manual Project Linking Safeguards
- Create project manually with estimate from a different customer; expect API rejection.
- Update existing project by changing estimate to one not owned by user; expect API rejection.
- Update project customer while keeping incompatible estimate; expect API rejection.

## Regression Smoke Checks
- Standard invoice creation from `/crm/invoices/new` still works.
- Standard project creation without estimate still works.
- Estimate list paging/filtering and row actions still work.
