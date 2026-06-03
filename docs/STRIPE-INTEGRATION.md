# Stripe integration — REMOVED (2026-06-03)

Stripe payment processing was **removed** from Peanut Gallery on 2026-06-03.
Peanut Gallery is free (BYOK + a one-off hosted demo); there is no paid tier, no
subscription, and no payment/checkout code in the product.

The Stripe webhook (`lib/stripe-webhook.ts`), the `checkout` / `webhook` /
`manage` subscription API routes, and the vestigial `stripe_sub_id` plumbing
were deleted. The prior implementation is preserved in git history. See
[`legal/TERMS-OF-SERVICE.md`](legal/TERMS-OF-SERVICE.md) for the current
(no-payments) terms.
