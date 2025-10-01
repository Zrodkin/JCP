// /Users/zalmansmac/Desktop/Website Folder/Projects/JCP/donation-site/app/donation/page.tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle } from "lucide-react"

// Initialize Stripe - replace with your publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const presetAmounts = [500, 770, 1260, 1800, 2600, 5000]

// Checkout form component that handles the actual payment
function CheckoutForm({ 
  amount, 
  donationType, 
  installmentMonths,
  monthlyEndDate,
  onSuccess,
  onError 
}: {
  amount: number
  donationType: "one-time" | "monthly"
  installmentMonths: number
  monthlyEndDate: number
  onSuccess: () => void
  onError: (error: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setMessage("")

    // Confirm the payment - this will redirect to success page
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/donation/success`,
      },
    })

    if (error) {
      setMessage(error.message || "An error occurred")
      onError(error.message || "Payment failed")
      setIsProcessing(false)
    }
    // If no error, the redirect will happen automatically
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement 
        options={{
          layout: "tabs",
          defaultValues: {
            billingDetails: {
              email: "",
            }
          }
        }}
      />
      
      {message && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {message}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={!stripe || isProcessing}
        className="w-full h-12 md:h-14 text-base md:text-lg font-semibold"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Donate $${amount.toFixed(2)} ${donationType === "monthly" ? "Monthly" : ""}`
        )}
      </Button>
    </form>
  )
}
// Main donation page component
export default function DonationPage() {
  const [donationType, setDonationType] = useState<"one-time" | "monthly">("one-time")
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")
  const [installmentMonths, setInstallmentMonths] = useState<number>(0)
  const [monthlyEndDate, setMonthlyEndDate] = useState<number>(0)
  const [clientSecret, setClientSecret] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "succeeded" | "failed">("idle")
  const [checkoutStarted, setCheckoutStarted] = useState(false)
  const [donorName, setDonorName] = useState("")
  const [donorEmail, setDonorEmail] = useState("")

  const totalAmount = selectedAmount || Number.parseFloat(customAmount) || 0
  const monthlyInstallment = installmentMonths > 0 ? totalAmount / installmentMonths : 0

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount)
    setCustomAmount("")
  }

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value)
    setSelectedAmount(null)
  }

  const handleStartCheckout = async () => {
    if (totalAmount <= 0) return

    // Validate name and email before proceeding
    if (!donorName.trim() || !donorEmail.trim()) {
      alert("Please enter your name and email to continue")
      return
    }

    setCheckoutStarted(true)
    setPaymentStatus("processing")

    try {
      // Create payment intent on the server
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(totalAmount * 100), // Convert to cents
          donationType,
          installmentMonths,
          monthlyEndDate,
          name: donorName,
          email: donorEmail,
        }),
      })

      const data = await response.json()
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setPaymentStatus("idle")
      } else if (data.error) {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error creating payment intent:", error)
      setPaymentStatus("failed")
      setCheckoutStarted(false)
    }
  }

  const handlePaymentSuccess = () => {
    setPaymentStatus("succeeded")
  }

  const handlePaymentError = (error: string) => {
    setPaymentStatus("failed")
    console.error("Payment error:", error)
  }

  // Payment Element appearance options
  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0570de',
      colorBackground: '#ffffff',
      colorText: '#30313d',
      colorDanger: '#df1b41',
      fontFamily: 'system-ui, sans-serif',
      borderRadius: '8px',
    },
  }

  const options = {
    clientSecret,
    appearance,
  }

  if (paymentStatus === "succeeded") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-4">
              Your donation has been processed successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              You will receive a receipt via email shortly.
            </p>
            <Button 
              className="mt-6"
              onClick={() => window.location.reload()}
            >
              Make Another Donation
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-12 lg:py-20">
        <div className="max-w-2xl mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-6 md:mb-8">
            <div className="relative w-32 h-32 md:w-48 md:h-48 lg:w-56 lg:h-56">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/JCP_logo-Fe5Lx5jI4aj91bquMhbTw0PavL7RAD.jpg"
                alt="Jewish Creative Preschool"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-3 md:mb-4 text-balance">
              Support Our Community
            </h1>
            <p className="hidden md:block text-base md:text-lg text-muted-foreground leading-relaxed text-pretty px-2">
              Your generous donation helps us continue providing a nurturing, Reggio-inspired learning environment for
              our children.
            </p>
          </div>

          {/* Donation Card */}
          <Card className="shadow-lg border-2">
            <CardHeader className="space-y-3 md:space-y-4 p-4 md:p-6">
              <CardTitle className="text-xl md:text-2xl font-serif">
                Make a Donation
              </CardTitle>
              <CardDescription className="text-sm md:text-base">
                Choose your donation frequency and amount
              </CardDescription>

              {/* Donation Type Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setDonationType("one-time")}
                  className={`flex-1 py-2.5 md:py-3 px-3 md:px-4 rounded-md text-sm md:text-base font-medium transition-all ${
                    donationType === "one-time"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  One-Time
                </button>
                <button
                  onClick={() => setDonationType("monthly")}
                  className={`flex-1 py-2.5 md:py-3 px-3 md:px-4 rounded-md text-sm md:text-base font-medium transition-all ${
                    donationType === "monthly"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly
                </button>
              </div>

              {donationType === "one-time" && (
                <div className="space-y-2 px-1 md:px-0">
                  <Label className="text-sm font-medium text-muted-foreground">Installment Plan (Optional)</Label>
                  <Select
                    value={installmentMonths.toString()}
                    onValueChange={(value) => setInstallmentMonths(Number.parseInt(value))}
                  >
                    <SelectTrigger className="h-11 md:h-12 text-sm md:text-base bg-muted border-muted hover:bg-muted/80 transition-colors">
                      <SelectValue placeholder="No Installments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-sm md:text-base py-2 md:py-3">
                        No Installments
                      </SelectItem>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((months) => {
                        const monthlyAmount = totalAmount > 0 ? (totalAmount / months).toFixed(2) : "0.00"
                        return (
                          <SelectItem
                            key={months}
                            value={months.toString()}
                            className="text-sm md:text-base py-2 md:py-3"
                          >
                            {months} monthly payments of ${monthlyAmount}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {donationType === "monthly" && (
                <div className="space-y-2 px-1 md:px-0">
                  <Label className="text-sm font-medium text-muted-foreground">Donation Duration (Optional)</Label>
                  <Select
                    value={monthlyEndDate.toString()}
                    onValueChange={(value) => setMonthlyEndDate(Number.parseInt(value))}
                  >
                    <SelectTrigger className="h-11 md:h-12 text-sm md:text-base bg-muted border-muted hover:bg-muted/80 transition-colors">
                      <SelectValue placeholder="No End Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-sm md:text-base py-2 md:py-3">
                        No End Date (Ongoing)
                      </SelectItem>
                      {[3, 6, 9, 12, 18, 24].map((months) => (
                        <SelectItem
                          key={months}
                          value={months.toString()}
                          className="text-sm md:text-base py-2 md:py-3"
                        >
                          {months} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6 md:space-y-8 p-4 md:p-6">
              {/* Preset Amounts */}
              <div className="space-y-3 md:space-y-4">
                <Label className="text-sm md:text-base font-medium">Select an amount</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleAmountSelect(amount)}
                      className={`py-3 md:py-4 px-3 md:px-4 rounded-lg border-2 font-semibold text-base md:text-lg transition-all ${
                        selectedAmount === amount
                          ? "border-primary bg-primary text-primary-foreground shadow-md scale-105"
                          : "border-border bg-card hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div className="space-y-2 md:space-y-3">
                <Label htmlFor="custom-amount" className="text-sm md:text-base font-medium">
                  Or enter a custom amount
                </Label>
                <div className="relative">
                  <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-base md:text-lg font-semibold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="custom-amount"
                    type="number"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    className="pl-7 md:pl-8 h-12 md:h-14 text-base md:text-lg border-2"
                    min="1"
                  />
                </div>
              </div>

              {/* Donation Summary */}
              {(selectedAmount || customAmount) && (
                <div className="p-3 md:p-4 bg-muted rounded-lg border border-border space-y-2">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm md:text-base text-muted-foreground">
                      {donationType === "monthly" ? "Monthly donation" : "One-time donation"}
                    </span>
                    <span className="text-xl md:text-2xl font-bold text-foreground">${totalAmount.toFixed(2)}</span>
                  </div>
                  {donationType === "one-time" && installmentMonths > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex justify-between items-center gap-2 text-xs md:text-sm">
                        <span className="text-muted-foreground">{installmentMonths} monthly payments of</span>
                        <span className="text-base md:text-lg font-semibold text-primary whitespace-nowrap">
                          ${monthlyInstallment.toFixed(2)}/mo
                        </span>
                      </div>
                    </div>
                  )}
                  {donationType === "monthly" && monthlyEndDate > 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex justify-between items-center gap-2 text-xs md:text-sm">
                        <span className="text-muted-foreground">Total over {monthlyEndDate} months</span>
                        <span className="text-base md:text-lg font-semibold text-primary whitespace-nowrap">
                          ${(totalAmount * monthlyEndDate).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Donor Information - Always visible when amount is selected */}
              {(selectedAmount || customAmount) && (
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-semibold">Your Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="donor-name">Full Name *</Label>
                      <Input
                        id="donor-name"
                        type="text"
                        placeholder="Jane Doe"
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="donor-email">Email Address *</Label>
                      <Input
                        id="donor-email"
                        type="email"
                        placeholder="jane.doe@example.com"
                        value={donorEmail}
                        onChange={(e) => setDonorEmail(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Section - Appears inline when checkout is started */}
              {checkoutStarted && clientSecret && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Payment Details</h3>
                  <Elements stripe={stripePromise} options={options}>
                    <CheckoutForm
                      amount={totalAmount}
                      donationType={donationType}
                      installmentMonths={installmentMonths}
                      monthlyEndDate={monthlyEndDate}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  </Elements>
                </div>
              )}

              {/* Continue to Payment Button */}
              {!checkoutStarted && (selectedAmount || customAmount) && (
                <Button
                  size="lg"
                  className="w-full h-12 md:h-14 text-base md:text-lg font-semibold"
                  disabled={!donorName.trim() || !donorEmail.trim()}
                  onClick={handleStartCheckout}
                >
                  Continue to Payment
                </Button>
              )}

              {/* Footer Text */}
              <p className="text-xs md:text-sm text-center text-muted-foreground leading-relaxed px-2">
                Your donation is tax-deductible. You will receive a receipt via email for your records.
              </p>
            </CardContent>
          </Card>

          {/* Impact Statement */}
          <div className="mt-8 md:mt-12 text-center px-4">
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto text-pretty">
            
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}