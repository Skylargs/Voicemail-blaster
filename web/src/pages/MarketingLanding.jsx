import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, RotateCcw, Zap, BarChart3, CheckCircle2 } from 'lucide-react'

export default function MarketingLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* Top Nav */}
      <nav className="border-b border-slate-800 bg-slate-950/70 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold">BusyLine AI</div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-slate-400 hover:text-slate-50 transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-slate-50 transition-colors">
              Pricing
            </a>
            <a href="#docs" className="text-sm text-slate-400 hover:text-slate-50 transition-colors">
              Docs
            </a>
            <Button asChild variant="outline" className="border-slate-800 hover:bg-slate-800">
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Book more jobs by never missing a call.
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed">
              BusyLine Voicemail Blaster drops personalized voicemails into warm leads' inboxes while you're still on the job site.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-indigo-500 hover:bg-indigo-400">
                <Link to="/register">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-800 hover:bg-slate-800">
                <a href="mailto:hello@busylineai.com">Talk to sales</a>
              </Button>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Warm Leads Campaign</h3>
                <span className="text-xs bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded-full">Active</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Leads</p>
                  <p className="text-2xl font-bold">127</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Calls</p>
                  <p className="text-2xl font-bold">89</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Success Rate</p>
                  <p className="text-2xl font-bold">94%</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Last Blast</p>
                  <p className="text-2xl font-bold">2h ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful features for your business</h2>
          <p className="text-slate-400 text-lg">Everything you need to automate your voicemail campaigns</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <Phone className="h-8 w-8 text-indigo-400 mb-2" />
              <CardTitle>Instant voicemail drops</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Drop personalized voicemails instantly to warm leads without waiting on hold.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <RotateCcw className="h-8 w-8 text-indigo-400 mb-2" />
              <CardTitle>Multi-number rotation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Rotate through multiple phone numbers to maximize deliverability and avoid flags.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <Zap className="h-8 w-8 text-indigo-400 mb-2" />
              <CardTitle>Smart machine detection</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Automatically detect answering machines and only leave voicemails when appropriate.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-indigo-400 mb-2" />
              <CardTitle>Live call analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track every call, view detailed logs, and monitor campaign performance in real-time.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-slate-400 text-lg">Choose the plan that works for you</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Starter</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-slate-400">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">500 calls/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">1 phone number</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">Basic analytics</span>
                </li>
              </ul>
              <Button asChild className="w-full" variant="outline">
                <Link to="/register">Choose plan</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 border-indigo-500">
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold">$99</span>
                <span className="text-slate-400">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">2,500 calls/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">3 phone numbers</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">Advanced analytics</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">Priority support</span>
                </li>
              </ul>
              <Button asChild className="w-full bg-indigo-500 hover:bg-indigo-400">
                <Link to="/register">Choose plan</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Agency</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold">$299</span>
                <span className="text-slate-400">/mo</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">10,000 calls/month</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">Unlimited numbers</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">White-label options</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">Dedicated support</span>
                </li>
              </ul>
              <Button asChild className="w-full" variant="outline">
                <Link to="/register">Choose plan</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently asked questions</h2>
        </div>
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg">How does voicemail dropping work?</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Our system automatically calls leads and uses smart detection to determine if an answering machine answered. If so, it plays your pre-recorded voicemail without ringing the phone.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg">Is this compliant with regulations?</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Yes, our system respects TCPA compliance. You must have prior consent from leads before contacting them. We provide tools to help you maintain compliance records.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg">Can I customize the voicemail message?</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Yes, you can upload your own voicemail recordings for each campaign. We support multiple audio formats including MP3, WAV, and M4A.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-400 text-sm">
          <p>&copy; 2024 BusyLine AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
