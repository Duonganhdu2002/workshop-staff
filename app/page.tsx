'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, type Registration } from '@/lib/supabase'
import { logoutStaff, getStaffEmail } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'sent'>('all')
  const [searchPhone, setSearchPhone] = useState<string>('')
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)
  const [staffEmail, setStaffEmail] = useState<string | null>(null)
  const router = useRouter()

  // Check if Supabase is configured
  const isConfigured = isSupabaseConfigured()

  useEffect(() => {
    // Get staff email
    const loadStaffEmail = async () => {
      const email = await getStaffEmail()
      setStaffEmail(email)
    }
    loadStaffEmail()
    
    if (isConfigured) {
      fetchRegistrations()
    } else {
      setLoading(false)
      setError('Cấu hình Supabase chưa đầy đủ')
    }
  }, [filter, isConfigured, searchPhone])

  const handleLogout = async () => {
    await logoutStaff()
    router.push('/login')
    router.refresh()
  }

  const fetchRegistrations = async () => {
    if (!isConfigured) {
      setError('Cấu hình Supabase chưa đầy đủ')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      let query = supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('payment_status', filter)
      }

      // Search by phone number if provided
      if (searchPhone.trim()) {
        // Remove spaces and format phone number for search
        const cleanPhone = searchPhone.trim().replace(/\s/g, '')
        query = query.ilike('phone', `%${cleanPhone}%`)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        // Log full error details
        console.error('Error fetching registrations:', {
          message: queryError.message,
          details: queryError.details,
          hint: queryError.hint,
          code: queryError.code,
          fullError: queryError
        })
        
        // Build detailed error message
        let errorMessage = 'Lỗi khi tải dữ liệu: '
        if (queryError.message) {
          errorMessage += queryError.message
        } else if (queryError.code) {
          errorMessage += `Code: ${queryError.code}`
        } else {
          errorMessage += 'Không thể kết nối đến database'
        }
        
        // Add hint if available
        if (queryError.hint) {
          errorMessage += ` (${queryError.hint})`
        }
        
        setError(errorMessage)
        setRegistrations([])
      } else {
        setRegistrations(data || [])
        setError(null)
      }
    } catch (err: any) {
      console.error('Unexpected error:', err)
      setError(`Lỗi không mong đợi: ${err.message || 'Đã xảy ra lỗi'}`)
      setRegistrations([])
    } finally {
      setLoading(false)
    }
  }

  // Helper function to send QR code email
  const sendQRCodeEmail = async (registration: Registration) => {
    if (!isConfigured) {
      throw new Error('Cấu hình Supabase chưa đầy đủ')
    }

    // Generate QR code data
    // Note: workshop_date will be automatically set in the API if it's null
    const qrData = JSON.stringify({
      id: registration.id,
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      workshop_date: registration.workshop_date,
      seat_number: registration.seat_number
    })

    // Call API to send email
    const response = await fetch('/api/send-qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registrationId: registration.id,
        email: registration.email,
        name: registration.name,
        qrData: qrData
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Không thể gửi email')
    }

    // Update status to 'sent' and save QR code
    const { error } = await supabase
      .from('registrations')
      .update({ 
        payment_status: 'sent',
        qr_code: qrData
      })
      .eq('id', registration.id)

    if (error) {
      throw new Error(error.message || 'Không thể cập nhật trạng thái')
    }

    return true
  }

  const verifyPayment = async (id: string) => {
    if (!isConfigured) {
      alert('Cấu hình Supabase chưa đầy đủ')
      return
    }

    try {
      // First, get the registration data before updating
      const { data: registration, error: fetchError } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !registration) {
        alert('Lỗi: ' + (fetchError?.message || 'Không tìm thấy đăng ký'))
        return
      }

      // Update payment status to 'verified'
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: 'verified' })
        .eq('id', id)

      if (error) {
        alert('Lỗi: ' + (error.message || 'Không thể cập nhật'))
        return
      }

      // Automatically send QR code email after payment verification
      setSendingEmailId(id)
      try {
        // Update registration object with verified status
        const updatedRegistration = { ...registration, payment_status: 'verified' as const }
        await sendQRCodeEmail(updatedRegistration)
        await fetchRegistrations()
        alert('Đã xác nhận thanh toán và gửi mã QR code thành công!')
      } catch (emailError: any) {
        console.error('Error sending email:', emailError)
        await fetchRegistrations()
        // Payment is verified but email failed - show warning but don't fail
        alert('Đã xác nhận thanh toán nhưng không thể gửi email: ' + emailError.message + '\n\nBạn có thể thử gửi lại bằng nút "Gửi QR Code"')
      } finally {
        setSendingEmailId(null)
      }
    } catch (err: any) {
      alert('Lỗi: ' + (err.message || 'Đã xảy ra lỗi'))
    }
  }

  const sendQRCode = async (registration: Registration) => {
    if (!isConfigured) {
      alert('Cấu hình Supabase chưa đầy đủ')
      return
    }

    if (sendingEmailId === registration.id) {
      return // Already sending
    }

    setSendingEmailId(registration.id)
    try {
      await sendQRCodeEmail(registration)
      await fetchRegistrations()
      alert('Đã gửi mã QR code thành công!')
    } catch (error: any) {
      console.error('Error sending QR code:', error)
      alert('Lỗi: ' + (error.message || 'Đã xảy ra lỗi khi gửi QR code'))
    } finally {
      setSendingEmailId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-blue-100 text-blue-800',
      sent: 'bg-green-100 text-green-800'
    }
    const labels = {
      pending: 'Chờ thanh toán',
      verified: 'Đã xác nhận',
      sent: 'Đã gửi QR'
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  // Show error screen if not configured
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-stripes md:bg-stripes-desktop text-black py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-black mb-4">Cấu hình thiếu</h1>
              <p className="text-gray-600 mb-6">
                Ứng dụng chưa được cấu hình đầy đủ. Vui lòng tạo file <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> với các biến môi trường sau:
              </p>
              <div className="bg-gray-50 rounded-lg p-6 text-left mb-6 border border-gray-200">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">
{`NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key`}
                </pre>
              </div>
              <p className="text-sm text-gray-500">
                Lấy các giá trị này từ Supabase project của bạn: <strong>Settings &gt; API</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stripes md:bg-stripes-desktop text-black py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Quản lý đăng ký Workshop</h1>
            <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
              Danh sách đăng ký và quản lý thanh toán
              {staffEmail && (
                <span className="ml-2 text-xs sm:text-sm text-gray-500 block sm:inline">• {staffEmail}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              href="/seats"
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-black text-white rounded-md hover:bg-gray-800 active:bg-gray-900 transition-colors font-medium text-sm sm:text-base min-h-[44px] sm:min-h-0 touch-manipulation text-center"
            >
              Quản lý Ghế
            </Link>
            <Link
              href="/scanner"
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] sm:min-h-0 touch-manipulation text-center"
            >
              Quét QR Code
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] sm:min-h-0 touch-manipulation w-full sm:w-auto"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
                <button
                  onClick={fetchRegistrations}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Thử lại
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-md border border-gray-200">
          <div className="border-b border-gray-200 p-3 sm:p-4">
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="flex gap-2 flex-wrap">
                {(['all', 'pending', 'verified', 'sent'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3 sm:px-4 py-2 rounded-md font-medium transition-colors text-sm sm:text-base min-h-[40px] sm:min-h-0 touch-manipulation ${
                      filter === status
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                    }`}
                  >
                    {status === 'all' ? 'Tất cả' : 
                     status === 'pending' ? 'Chờ thanh toán' :
                     status === 'verified' ? 'Đã xác nhận' : 'Đã gửi QR'}
                  </button>
                ))}
              </div>
              
              {/* Search by phone */}
              <div className="flex-1 md:max-w-xs">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tìm theo số điện thoại..."
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white text-black text-sm sm:text-base min-h-[44px] sm:min-h-0"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {searchPhone && (
                    <button
                      onClick={() => setSearchPhone('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
              <p className="mt-4 text-gray-600">Đang tải...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              {error}
            </div>
          ) : registrations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchPhone ? (
                <div>
                  <p className="mb-2">Không tìm thấy đăng ký với số điện thoại: <strong>{searchPhone}</strong></p>
                  <button
                    onClick={() => setSearchPhone('')}
                    className="text-black hover:text-gray-800 underline"
                  >
                    Xóa bộ lọc tìm kiếm
                  </button>
                </div>
              ) : (
                'Không có đăng ký nào'
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-200">
                {registrations.map((reg) => (
                  <div key={reg.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 truncate">{reg.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{new Date(reg.created_at).toLocaleString('vi-VN')}</p>
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        {getStatusBadge(reg.payment_status)}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div>
                        <span className="text-xs text-gray-500">Email:</span>
                        <p className="text-sm text-gray-900 break-all">{reg.email}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">SĐT:</span>
                        <p className="text-sm text-gray-900">{reg.phone}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-xs text-gray-500">Ngày workshop:</span>
                          <p className="text-sm text-gray-900">
                            {(() => {
                              const workshopDate = reg.workshop_date ? new Date(reg.workshop_date) : null
                              const isValidDate = workshopDate && !isNaN(workshopDate.getTime()) && workshopDate.getFullYear() > 1970
                              const displayDate = isValidDate ? workshopDate : new Date('2025-12-28')
                              return displayDate.toLocaleDateString('vi-VN')
                            })()}
                          </p>
                        </div>
                        {reg.seat_number && (
                          <div>
                            <span className="text-xs text-gray-500">Ghế:</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ml-1">
                              {reg.seat_number}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-gray-200">
                      {reg.payment_status === 'pending' && (
                        <button
                          onClick={() => verifyPayment(reg.id)}
                          disabled={sendingEmailId === reg.id}
                          className={`w-full font-medium flex items-center justify-center gap-2 py-2.5 px-4 rounded-md min-h-[44px] touch-manipulation ${
                            sendingEmailId === reg.id
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-black text-white hover:bg-gray-800 active:bg-gray-900'
                          }`}
                        >
                          {sendingEmailId === reg.id && (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {sendingEmailId === reg.id ? 'Đang gửi mail...' : 'Xác nhận thanh toán'}
                        </button>
                      )}
                      {reg.payment_status === 'verified' && (
                        <button
                          onClick={() => sendQRCode(reg)}
                          disabled={sendingEmailId === reg.id}
                          className={`w-full font-medium flex items-center justify-center gap-2 py-2.5 px-4 rounded-md min-h-[44px] touch-manipulation ${
                            sendingEmailId === reg.id
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800'
                          }`}
                        >
                          {sendingEmailId === reg.id && (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {sendingEmailId === reg.id ? 'Đang gửi mail...' : 'Gửi QR Code'}
                        </button>
                      )}
                      {reg.payment_status === 'sent' && (
                        <div className="text-center text-sm text-gray-400 py-2">Đã hoàn tất</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tên khách hàng
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SĐT
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ngày workshop
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ghế ngồi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{reg.name}</div>
                          <div className="text-xs text-gray-500">{new Date(reg.created_at).toLocaleString('vi-VN')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{reg.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{reg.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {(() => {
                              const workshopDate = reg.workshop_date ? new Date(reg.workshop_date) : null
                              const isValidDate = workshopDate && !isNaN(workshopDate.getTime()) && workshopDate.getFullYear() > 1970
                              const displayDate = isValidDate ? workshopDate : new Date('2025-12-28')
                              return displayDate.toLocaleDateString('vi-VN')
                            })()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {reg.seat_number ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Ghế {reg.seat_number}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(reg.payment_status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            {reg.payment_status === 'pending' && (
                              <button
                                onClick={() => verifyPayment(reg.id)}
                                disabled={sendingEmailId === reg.id}
                                className={`font-medium flex items-center gap-2 ${
                                  sendingEmailId === reg.id
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-black hover:text-gray-800'
                                }`}
                              >
                                {sendingEmailId === reg.id && (
                                  <>
                                    <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Đang gửi mail đến khách hàng...</span>
                                  </>
                                )}
                                {sendingEmailId !== reg.id && 'Xác nhận thanh toán'}
                              </button>
                            )}
                            {reg.payment_status === 'verified' && (
                              <button
                                onClick={() => sendQRCode(reg)}
                                disabled={sendingEmailId === reg.id}
                                className={`font-medium flex items-center gap-2 ${
                                  sendingEmailId === reg.id
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-black hover:text-gray-800'
                                }`}
                              >
                                {sendingEmailId === reg.id && (
                                  <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                )}
                                {sendingEmailId === reg.id ? 'Đang gửi mail đến khách hàng...' : 'Gửi QR Code'}
                              </button>
                            )}
                            {reg.payment_status === 'sent' && (
                              <span className="text-gray-400">Đã hoàn tất</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
