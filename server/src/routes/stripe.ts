import { Router } from 'express'
import Stripe from 'stripe'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

// POST /api/stripe/create-checkout — create Stripe Checkout session
router.post('/create-checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
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

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

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
})

// POST /api/stripe/webhook — Stripe webhook handler (uses raw body)
router.post('/webhook', async (req, res) => {
  const stripe = getStripe()
  const sig = req.headers['stripe-signature'] as string

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(500).json({ error: 'Webhook secret not configured' })
    return
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const subscriptionId = session.subscription as string

      if (userId && subscriptionId) {
        const subResponse = await stripe.subscriptions.retrieve(subscriptionId)
        const subscription = subResponse as any

        await supabaseAdmin
          .from('investor_subscriptions')
          .update({
            stripe_subscription_id: subscriptionId,
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            plan_id: process.env.STRIPE_PRICE_ID,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        // Update user role to investor
        await supabaseAdmin
          .from('profiles')
          .update({ role: 'investor', updated_at: new Date().toISOString() })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscriptionObj = event.data.object as any
      const customerId = subscriptionObj.customer as string

      const { data: sub } = await supabaseAdmin
        .from('investor_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (sub) {
        const status = subscriptionObj.status === 'active' ? 'active'
          : subscriptionObj.status === 'past_due' ? 'past_due'
          : subscriptionObj.status === 'trialing' ? 'trialing'
          : subscriptionObj.status === 'canceled' ? 'canceled'
          : 'inactive'

        await supabaseAdmin
          .from('investor_subscriptions')
          .update({
            status,
            current_period_start: new Date(subscriptionObj.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscriptionObj.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId)

        // If canceled, revert role to client
        if (status === 'canceled') {
          await supabaseAdmin
            .from('profiles')
            .update({ role: 'client', updated_at: new Date().toISOString() })
            .eq('id', sub.user_id)
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const deletedSub = event.data.object as any
      const customerId = deletedSub.customer as string

      const { data: sub } = await supabaseAdmin
        .from('investor_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (sub) {
        await supabaseAdmin
          .from('investor_subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId)

        await supabaseAdmin
          .from('profiles')
          .update({ role: 'client', updated_at: new Date().toISOString() })
          .eq('id', sub.user_id)
      }
      break
    }
  }

  res.json({ received: true })
})

// POST /api/stripe/portal — create billing portal session
router.post('/portal', requireAuth, async (req: AuthenticatedRequest, res) => {
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

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${frontendUrl}/#/investor/subscription`
  })

  res.json({ url: session.url })
})

export default router
