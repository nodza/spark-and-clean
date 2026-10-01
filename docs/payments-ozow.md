# Ozow Instant EFT

South African customers can pay a deposit or remaining balance by Instant EFT through Ozow. Success uses the same `ledger.recordSuccess` path as Stripe — there is no second `paymentStatus` branch.

## Environment variables

Set these in the host secret store or local `.env`. Do not commit values.

| Name | Used by |
| --- | --- |
| `OZOW_SITE_CODE` | Server. Merchant site code from the Ozow dashboard. |
| `OZOW_PRIVATE_KEY` | Server. Signs payment requests and verifies notification hashes. Never sent to Ozow. |
| `OZOW_API_KEY` | Server. Sent as the `ApiKey` header on `POST /postpaymentrequest`. |
| `APP_URL` | Server. Public origin for success / cancel / notify URLs (no trailing path). |
| `OZOW_IS_TEST` | Optional. `true` / `false`. Defaults to test outside production. |

Hide Instant EFT in the UI when any of `OZOW_SITE_CODE`, `OZOW_PRIVATE_KEY`, or `OZOW_API_KEY` is missing.

## Endpoints

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/payments/create-session` | `{ bookingId, kind: "DEPOSIT" \| "BALANCE", provider: "OZOW" }` → `{ url }` |
| `POST` | `/api/webhooks/ozow` | Ozow notify URL. Verifies `Hash`, then `ledger.recordSuccess({ provider: "ozow" })`. |
| `GET` | `/api/payments/providers` | `{ stripe, ozow }` booleans for the PayButton chooser. |

`providerRef` is Ozow's `TransactionId`, so a Stripe deposit and an Ozow balance on the same booking do not collide.
