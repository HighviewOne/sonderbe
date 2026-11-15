import { Router } from 'express'
import Stripe from 'stripe'
import { supabaseAdmin } from '../config.js'
import { requireAuth, invalidateRoleCache } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { endedAtFor } from '../access.js'

const router = Router()

// Stripe SDK v20 removed these from the TS type but the API still returns them
interface SubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start: number
  current_period_end: number
}

// Created lazily so a missing key only breaks Stripe routes, not the whole server
let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return stripeClient
}

// POST /api/stripe/create-checkout — create Stripe Checkout session
router.post('/create-checkout', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const stripe = getStripe()
  const priceId = process.env.STRIPE_PRICE_ID

  if (!priceId) {
    res.status(500).json({ error: 'Stripe price not configured' })
    return
  }

  // Get or create Stripe customer
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name')
    .eq('id', req.userId!)
    .single()

  if (!profile) {
    res.status(404).json({ error: 'Profile not found' })
    return
  }

  // Check for existing subscription record
  const { data: existingSub } = await supabaseAdmin
    .from('investor_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', req.userId!)
    .single()

  let customerId = existingSub?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      name: profile.full_name || undefined,
      metadata: { user_id: req.userId! }
    })
    customerId = customer.id

    // Create subscription record
    await supabaseAdmin.from('investor_subscriptions').upsert({
      user_id: req.userId!,
      stripe_customer_id: customerId,
      status: 'inactive'
    })
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${frontendUrl}/#/investor?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/#/investor/subscribe`,
    metadata: { user_id: req.userId! }
  })

  res.json({ url: session.url })
}))

// POST /api/stripe/webhook — Stripe webhook handler (raw body parsed in index.ts)
router.post('/webhook', asyncHandler(async (req, res) => {
  const stripe = getStripe()
  const sig = req.headers['stripe-signature'] as string

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(500).json({ error: 'Webhook secret not configured' })
    return
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature verification failed:', message)
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const subscriptionId = session.subscription as string

        if (!userId) {
          console.error('Webhook checkout.session.completed missing user_id in metadata')
          break
        }

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as SubscriptionWithPeriod

          await supabaseAdmin
            .from('investor_subscriptions')
            .update({
              stripe_subscription_id: subscriptionId,
              status: 'active',
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              plan_id: process.env.STRIPE_PRICE_ID,
              past_due_since: null,
              ended_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)

          // Update user role to investor
          await supabaseAdmin
            .from('profiles')
            .update({ role: 'investor', updated_at: new Date().toISOString() })
            .eq('id', userId)
          invalidateRoleCache(userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscriptionObj = event.data.object as SubscriptionWithPeriod
        const customerId = subscriptionObj.customer as string

        const { data: sub } = await supabaseAdmin
          .from('investor_subscriptions')
          .select('user_id, past_due_since, ended_at')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub) {
          // 'unpaid' = Stripe stopped retrying: treat as ended. 'incomplete' / 'incomplete_expired'
          // = the first payment never went through: 'inactive' with no end date (never had access).
          const status = subscriptionObj.status === 'active' ? 'active'
            : subscriptionObj.status === 'past_due' ? 'past_due'
            : subscriptionObj.status === 'trialing' ? 'trialing'
            : subscriptionObj.status === 'canceled' || subscriptionObj.status === 'unpaid' ? 'canceled'
            : 'inactive'
          const now = new Date().toISOString()

          // Dates drive the grace and read-only periods (see access.ts). The professional keeps
          // their account and role; access is decided from these, not by demoting the role.
          await supabaseAdmin
            .from('investor_subscriptions')
            .update({
              status,
              current_period_start: new Date(subscriptionObj.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscriptionObj.current_period_end * 1000).toISOString(),
              past_due_since: status === 'past_due' ? (sub.past_due_since ?? now) : null,
              // Keep the first end date; an ended subscription's clock never restarts
              ended_at: status === 'canceled' ? endedAtFor(sub.ended_at, sub.past_due_since)
                : status === 'inactive' ? sub.ended_at : null,
              updated_at: now
            })
            .eq('stripe_customer_id', customerId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object as SubscriptionWithPeriod
        const customerId = deletedSub.customer as string

        const { data: sub } = await supabaseAdmin
          .from('investor_subscriptions')
          .select('user_id, status, ended_at, past_due_since, current_period_start')
          .eq('stripe_customer_id', customerId)
          .single()

        if (sub) {
          const now = new Date().toISOString()
          // A subscription that never got a first payment never had access: no read-only period
          const neverPaid = sub.status === 'inactive' && !sub.ended_at && !sub.current_period_start
          await supabaseAdmin
            .from('investor_subscriptions')
            .update({
              status: 'canceled',
              ended_at: neverPaid ? null : endedAtFor(sub.ended_at, sub.past_due_since),
              past_due_since: null,
              updated_at: now
            })
            .eq('stripe_customer_id', customerId)
        }
        break
      }
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    // Still return 200 to Stripe so it doesn't retry
  }

  res.json({ received: true })
}))

// POST /api/stripe/portal — create billing portal session
router.post('/portal', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const stripe = getStripe()
  const { data: sub } = await supabaseAdmin
    .from('investor_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', req.userId!)
    .single()

  if (!sub?.stripe_customer_id) {
    res.status(404).json({ error: 'No subscription found' })
    return
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${frontendUrl}/#/investor/subscription`
  })

  res.json({ url: session.url })
}))

export default router
