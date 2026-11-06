This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Copy `.env.example` to `.env.local` and fill in values for MongoDB, Stripe, and Ozow as needed.

| Payments | Variables |
| --- | --- |
| Stripe (card) | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` |
| Ozow (Instant EFT) | `OZOW_SITE_CODE`, `OZOW_PRIVATE_KEY`, `OZOW_API_KEY`, `APP_URL` |
| Address search | `GOOGLE_MAPS_API_KEY` (preferred; Places API New + Geocoding API) or `MAPBOX_ACCESS_TOKEN`. Optional `GEOCODER_PROVIDER=google` or `mapbox`. Server-only — do not prefix the key with `NEXT_PUBLIC_`. Results are limited to Cape Town and Gauteng. With neither key set, a booking still saves and the driver map uses the suburb or city centre. |

See `docs/payments-stripe.md` and `docs/payments-ozow.md`.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
