// app/api/create-payment-intent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil'
})

export async function POST(request: NextRequest) {
  try {
    const { amount, donationType, installmentMonths, monthlyEndDate } = await request.json()

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount: amount, // Amount should already be in cents from frontend
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        donation_type: donationType,
      }
    }

    // Handle recurring donations
    if (donationType === 'monthly') {
      // For recurring donations, we'll create a subscription after payment succeeds
      // Store the subscription details in metadata for webhook processing
      paymentIntentData.metadata = {
        ...paymentIntentData.metadata,
        type: 'subscription_setup',
        monthly_amount: amount.toString(),
        end_after_months: monthlyEndDate.toString() || 'ongoing'
      }
      paymentIntentData.setup_future_usage = 'off_session'
    }

    // Handle installment plans for one-time donations
    if (donationType === 'one-time' && installmentMonths > 0) {
      // For installment plans, we'll create a subscription schedule after payment
      // First payment is processed immediately, rest are scheduled
      const firstPayment = Math.ceil(amount / installmentMonths)
      
      paymentIntentData.amount = firstPayment
      paymentIntentData.metadata = {
        ...paymentIntentData.metadata,
        type: 'installment_plan',
        total_amount: amount.toString(),
        installments: installmentMonths.toString(),
        installment_amount: firstPayment.toString()
      }
      paymentIntentData.setup_future_usage = 'off_session'
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}