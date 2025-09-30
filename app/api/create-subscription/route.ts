// app/api/create-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
 apiVersion: '2025-08-27.basil'
})

export async function POST(request: NextRequest) {
  try {
    const { customerId, priceId, paymentMethodId, endAfterMonths } = await request.json()

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    })

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    // Create subscription
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
    }

    // If subscription has an end date, create a subscription schedule
    if (endAfterMonths && endAfterMonths > 0) {
      const schedule = await stripe.subscriptionSchedules.create({
        customer: customerId,
        start_date: 'now',
        end_behavior: 'cancel',
        phases: [
          {
            items: [{ price: priceId }],
            iterations: endAfterMonths,
          },
        ],
      })

      return NextResponse.json({ schedule })
    } else {
      // Create ongoing subscription
      const subscription = await stripe.subscriptions.create(subscriptionData)
      return NextResponse.json({ subscription })
    }
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    )
  }
}