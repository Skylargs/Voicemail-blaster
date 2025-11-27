import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime, formatPhone } from '@/lib/utils'

const PAGE_SIZE = 20

function getStatusBadge(status) {
  if (!status) return <Badge variant="outline">Unknown</Badge>
  const statusLower = status.toLowerCase()
  if (statusLower.includes('machine') || statusLower === 'amd-machine') {
    return <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20">Machine</Badge>
  }
  if (statusLower.includes('human') || statusLower === 'amd-human') {
    return <Badge className="bg-yellow-500/10 text-yellow-300 border-yellow-500/20">Human</Badge>
  }
  if (statusLower.includes('no-answer') || statusLower === 'no-answer') {
    return <Badge className="bg-gray-500/10 text-gray-300 border-gray-500/20">No Answer</Badge>
  }
  return <Badge variant="outline">{status}</Badge>
}

export default function CallLogsPage() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadCallLogs()
  }, [])

  async function loadCallLogs() {
    try {
      setLoading(true)
      const response = await fetch('/call-logs', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Error loading call logs:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter logs based on search and date range
  const filteredLogs = useMemo(() => {
    let filtered = [...logs]

    // Date range filter
    if (dateRange !== 'all') {
      const now = Date.now()
      const ranges = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      }
      const cutoff = now - ranges[dateRange]
      filtered = filtered.filter(log => new Date(log.createdAt).getTime() >= cutoff)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(log =>
        log.leadName?.toLowerCase().includes(query) ||
        log.leadNumber?.includes(query) ||
        log.campaignName?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [logs, searchQuery, dateRange])

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE)
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, dateRange])

  if (loading) {
    return (
      <div className="text-center py-10 text-slate-400">
        Loading call logs...
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-slate-400 mb-4">No calls yet</p>
          <Button onClick={() => navigate('/app/campaigns')}>
            Start a blast
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Call Logs</h1>
        <p className="text-slate-400 text-sm mt-1">View and filter your call history</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by lead name, number, or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-2 rounded-md bg-slate-900 border border-slate-800 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Lead Name</TableHead>
                <TableHead>Lead Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Success</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No calls found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.campaignName}</TableCell>
                    <TableCell>{log.leadName || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-sm">{formatPhone(log.leadNumber)}</TableCell>
                    <TableCell>{getStatusBadge(log.status || log.answeredBy)}</TableCell>
                    <TableCell>{log.duration ? `${log.duration}s` : 'N/A'}</TableCell>
                    <TableCell className="text-sm text-slate-400">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">Delivered</Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-300 border-red-500/20">Failed</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} calls
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
