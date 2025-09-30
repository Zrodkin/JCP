// app/api/webhook/route.ts
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil'
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
 const body = await request.text()
const headersList = await headers()
const signature = headersList.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Check if this is for a subscription or installment plan
        const metadata = paymentIntent.metadata
        
        if (metadata.type === 'subscription_setup') {
          // Create a recurring subscription
          await handleSubscriptionSetup(paymentIntent)
        } else if (metadata.type === 'installment_plan') {
          // Create an installment plan using subscription schedules
          await handleInstallmentPlan(paymentIntent)
        } else {
          // Regular one-time donation
          await handleOneTimeDonation(paymentIntent)
        }
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Handle subscription lifecycle events
        const subscription = event.data.object as Stripe.Subscription
        console.log('Subscription event:', event.type, subscription.id)
        // Add your business logic here (e.g., update database, send emails)
        break

      case 'invoice.payment_succeeded':
        // Handle successful subscription payments
        const invoice = event.data.object as Stripe.Invoice
        console.log('Invoice paid:', invoice.id)
        // Send receipt email, update donor records, etc.
        break

      case 'invoice.payment_failed':
        // Handle failed subscription payments
        const failedInvoice = event.data.object as Stripe.Invoice
        console.log('Invoice payment failed:', failedInvoice.id)
        // Send notification to donor, retry logic, etc.
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// Helper functions for webhook handlers
async function handleSubscriptionSetup(paymentIntent: Stripe.PaymentIntent) {
  const customerId = paymentIntent.customer as string
  const monthlyAmount = parseInt(paymentIntent.metadata.monthly_amount)
  const endAfterMonths = paymentIntent.metadata.end_after_months === 'ongoing' 
    ? null 
    : parseInt(paymentIntent.metadata.end_after_months)

  // Create a price for the monthly donation
  const price = await stripe.prices.create({
    unit_amount: monthlyAmount,
    currency: 'usd',
    recurring: { interval: 'month' },
    product_data: {
      name: 'Monthly Donation',
    },
  })

  // Get the payment method from the payment intent
  const paymentMethodId = paymentIntent.payment_method as string

  if (endAfterMonths) {
    // Create subscription schedule with end date
    await stripe.subscriptionSchedules.create({
      customer: customerId,
      start_date: 'now',
      end_behavior: 'cancel',
      phases: [
        {
          items: [{ price: price.id }],
          iterations: endAfterMonths,
        },
      ],
      default_settings: {
        default_payment_method: paymentMethodId,
      },
    })
  } else {
    // Create ongoing subscription
    await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId,
    })
  }
}

async function handleInstallmentPlan(paymentIntent: Stripe.PaymentIntent) {
  const customerId = paymentIntent.customer as string
  const totalAmount = parseInt(paymentIntent.metadata.total_amount)
  const installments = parseInt(paymentIntent.metadata.installments)
  const installmentAmount = Math.ceil(totalAmount / installments)
  const paymentMethodId = paymentIntent.payment_method as string

  // Create a price for the installment payments
  const price = await stripe.prices.create({
    unit_amount: installmentAmount,
    currency: 'usd',
    recurring: { interval: 'month' },
    product_data: {
      name: `Installment Payment (${installments} total)`,
    },
  })

  // Create subscription schedule for remaining installments
  // First payment already processed, so iterations = installments - 1
  await stripe.subscriptionSchedules.create({
    customer: customerId,
    start_date: 'now',
    end_behavior: 'cancel',
    phases: [
      {
        items: [{ price: price.id }],
        iterations: installments - 1, // Minus one because first payment already made
      },
    ],
    default_settings: {
      default_payment_method: paymentMethodId,
    },
  })
}

async function handleOneTimeDonation(paymentIntent: Stripe.PaymentIntent) {
  // Log the donation, send thank you email, update donor database, etc.
  console.log('One-time donation received:', {
    amount: paymentIntent.amount / 100,
    customer: paymentIntent.customer,
    receipt_email: paymentIntent.receipt_email,
  })
  
  // Add your business logic here
  // For example:
  // - Store donation record in database
  // - Send tax receipt email
  // - Update donor CRM
  // - Trigger thank you automation
}