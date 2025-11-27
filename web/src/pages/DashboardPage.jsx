import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Phone, TrendingUp, Clock } from 'lucide-react'
import { fetchBillingUsage, centsToDollars } from '@/lib/billingClient'

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaigns()
  }, [])

  async function loadCampaigns() {
    try {
      setLoading(true)
      const response = await fetch('/campaigns', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setCampaigns(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading campaigns:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch call logs to get last blast time
  const [lastBlastAt, setLastBlastAt] = useState(null)
  
  useEffect(() => {
    async function fetchLastBlast() {
      try {
        const response = await fetch('/call-logs', {
          credentials: 'include'
        })
        if (response.ok) {
          const data = await response.json()
          const logs = data.logs || []
          if (logs.length > 0) {
            setLastBlastAt(logs[0].createdAt)
          }
        }
      } catch (err) {
        console.error('Error fetching call logs:', err)
      }
    }
    fetchLastBlast()
  }, [])

  // Billing usage state
  const [billingUsage, setBillingUsage] = useState({
    loading: true,
    error: null,
    usageCents: 0,
    events: [],
    billingPeriodStart: null,
    billingPeriodEnd: null,
  })

  useEffect(() => {
    let isMounted = true

    fetchBillingUsage()
      .then((data) => {
        if (!isMounted) return
        setBillingUsage({
          loading: false,
          error: null,
          usageCents: data.usageCents ?? 0,
          events: data.events ?? [],
          billingPeriodStart: data.billingPeriodStart ?? null,
          billingPeriodEnd: data.billingPeriodEnd ?? null,
        })
      })
      .catch((err) => {
        console.error('Error loading billing usage:', err)
        if (!isMounted) return
        setBillingUsage((prev) => ({
          ...prev,
          loading: false,
          error: 'Unable to load usage right now.',
        }))
      })

    return () => {
      isMounted = false
    }
  }, [])

  const totalCampaigns = campaigns.length
  const totalLeads = campaigns.reduce((sum, c) => sum + (c._count?.leads || 0), 0)
  const totalCalls = campaigns.reduce((sum, c) => sum + (c._count?.callLogs || 0), 0)
  
  const lastBlastText = lastBlastAt 
    ? `${Math.floor((Date.now() - new Date(lastBlastAt).getTime()) / (1000 * 60 * 60))} hours ago`
    : 'No blasts yet'

  // Dummy data for call volume visualization (last 7 days)
  // TODO: Replace with actual call volume data when available from backend
  const callVolumeData = [12, 18, 15, 22, 19, 25, 20] // Placeholder data

  const statCards = [
    { label: 'Total Campaigns', value: totalCampaigns, icon: Phone },
    { label: 'Total Leads', value: totalLeads, icon: Phone },
    { label: 'Total Calls', value: totalCalls, icon: Phone },
    { label: 'Last Blast', value: lastBlastText, icon: Clock },
  ]

  return (
    <div className="space-y-6">
      {/* Analytics Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">
                    {stat.label}
                  </p>
                  <Icon className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-2xl font-semibold text-slate-50">
                  {stat.value}
                </p>
              </div>
            </motion.div>
          )
        })}
        {/* Billing Usage Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">
                Estimated usage this period
              </p>
            </div>
            <div className="flex flex-col">
              {billingUsage.loading ? (
                <div className="text-sm text-slate-400">Loading…</div>
              ) : billingUsage.error ? (
                <div className="text-sm text-red-400">{billingUsage.error}</div>
              ) : (
                <>
                  <p className="text-2xl font-semibold text-slate-50">
                    ${centsToDollars(billingUsage.usageCents).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Internal estimate — metered billing to come
                  </p>
                  {billingUsage.billingPeriodStart && billingUsage.billingPeriodEnd ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Current period: {new Date(billingUsage.billingPeriodStart).toLocaleDateString()} – {new Date(
                        billingUsage.billingPeriodEnd,
                      ).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Billing period will start with your first blast.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Call Volume Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.2 }}
      >
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-50">Recent Call Volume</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 7 days</p>
            </div>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {callVolumeData.map((value, index) => {
              const maxValue = Math.max(...callVolumeData)
              const height = (value / maxValue) * 100
              return (
                <div
                  key={index}
                  className="flex-1 bg-indigo-500/30 rounded-t hover:bg-indigo-500/50 transition-colors"
                  style={{ height: `${height}%` }}
                  title={`${value} calls`}
                />
              )
            })}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

