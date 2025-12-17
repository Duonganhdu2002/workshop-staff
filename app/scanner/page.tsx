'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { logoutStaff, getStaffEmail } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [staffEmail, setStaffEmail] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const qrCodeRegionId = 'qr-reader'
  const router = useRouter()
  
  // Check if Supabase is configured
  const isConfigured = isSupabaseConfigured()

  // Detect Safari browser
  const isSafari = () => {
    if (typeof window === 'undefined') return false
    const ua = window.navigator.userAgent.toLowerCase()
    return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium')
  }

  // Get available cameras and find back camera
  const getBackCameraId = async (): Promise<string | null> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      // Try to find back camera (usually labeled as "back" or "environment")
      for (const device of videoDevices) {
        const label = device.label.toLowerCase()
        if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
          return device.deviceId
        }
      }
      
      // If no back camera found, return the last camera (usually back on mobile)
      if (videoDevices.length > 1) {
        return videoDevices[videoDevices.length - 1].deviceId
      }
      
      // Return first available camera
      return videoDevices[0]?.deviceId || null
    } catch (err) {
      console.error('Error enumerating devices:', err)
      return null
    }
  }

  useEffect(() => {
    const loadStaffEmail = async () => {
      const email = await getStaffEmail()
      setStaffEmail(email)
    }
    loadStaffEmail()
  }, [])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const startScanning = async () => {
    try {
      setError(null)
      setCustomerInfo(null)
      
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập camera. Vui lòng sử dụng trình duyệt khác hoặc cấp quyền truy cập camera.')
      }

      // Check HTTPS requirement for Safari
      if (isSafari() && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error('Safari yêu cầu kết nối HTTPS để truy cập camera. Vui lòng sử dụng HTTPS hoặc thử trên trình duyệt khác.')
      }

      // Set scanning to true first so React renders the element
      setScanning(true)
      
      // Wait for React to render the element before initializing scanner
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify element exists
      const element = document.getElementById(qrCodeRegionId)
      if (!element) {
        throw new Error('Không tìm thấy phần tử quét QR. Vui lòng thử lại.')
      }

      const html5QrCode = new Html5Qrcode(qrCodeRegionId)
      scannerRef.current = html5QrCode

      // Configure camera based on browser
      let cameraConfig: any
      
      if (isSafari()) {
        // Safari: Try to get deviceId for back camera
        const backCameraId = await getBackCameraId()
        if (backCameraId) {
          cameraConfig = { deviceId: { exact: backCameraId } }
        } else {
          // Fallback: try facingMode, Safari might support it
          cameraConfig = { facingMode: 'environment' }
        }
      } else {
        // Other browsers: use facingMode
        cameraConfig = { facingMode: 'environment' }
      }

      // Calculate QR box size based on screen width (responsive)
      const screenWidth = window.innerWidth
      const qrBoxSize = screenWidth < 640 ? Math.min(screenWidth - 80, 300) : 250
      
      await html5QrCode.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: qrBoxSize, height: qrBoxSize },
          // Safari-specific: use lower fps for better compatibility
          ...(isSafari() && { fps: 5 })
        },
        (decodedText) => {
          handleQRCodeScanned(decodedText)
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      )
    } catch (err: any) {
      let errorMessage = 'Không thể khởi động camera'
      
      if (err && err.message) {
        errorMessage += ': ' + err.message
      } else if (err && typeof err === 'string') {
        errorMessage += ': ' + err
      } else if (err) {
        errorMessage += ': ' + String(err)
      } else {
        errorMessage += '. Vui lòng kiểm tra quyền truy cập camera và thử lại.'
      }
      
      // Provide more specific error messages for common issues
      if (err && err.name === 'NotAllowedError') {
        errorMessage = 'Không có quyền truy cập camera. Vui lòng cấp quyền trong cài đặt trình duyệt.'
        if (isSafari()) {
          errorMessage += ' (Safari: Cài đặt > Safari > Camera > Cho phép)'
        }
      } else if (err && err.name === 'NotFoundError') {
        errorMessage = 'Không tìm thấy camera. Vui lòng kiểm tra thiết bị của bạn.'
      } else if (err && err.name === 'NotReadableError') {
        errorMessage = 'Camera đang được sử dụng bởi ứng dụng khác. Vui lòng đóng ứng dụng khác và thử lại.'
      } else if (err && err.name === 'OverconstrainedError') {
        // Safari might throw this if camera constraints are not supported
        errorMessage = 'Camera không hỗ trợ cấu hình này. Đang thử cấu hình khác...'
        // Retry with simpler config
        setTimeout(() => {
          retryWithSimpleConfig()
        }, 500)
        return
      }
      
      setError(errorMessage)
      console.error('Camera error:', err)
      setScanning(false)
    }
  }

  const retryWithSimpleConfig = async () => {
    try {
      setError(null)
      
      // Ensure element exists
      const element = document.getElementById(qrCodeRegionId)
      if (!element) {
        setScanning(true)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const html5QrCode = new Html5Qrcode(qrCodeRegionId)
      scannerRef.current = html5QrCode

      // Use simplest config for Safari
      const screenWidth = window.innerWidth
      const qrBoxSize = screenWidth < 640 ? Math.min(screenWidth - 80, 300) : 250
      
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 5,
          qrbox: { width: qrBoxSize, height: qrBoxSize }
        },
        (decodedText) => {
          handleQRCodeScanned(decodedText)
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      )

      setScanning(true)
    } catch (err: any) {
      setError('Không thể khởi động camera. Vui lòng thử lại hoặc sử dụng chức năng nhập thủ công.')
      console.error('Retry camera error:', err)
      setScanning(false)
    }
  }

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (err) {
        console.error(err)
      }
      scannerRef.current = null
    }
    setScanning(false)
  }

  const handleQRCodeScanned = async (decodedText: string) => {
    if (!isConfigured) {
      setError('Cấu hình Supabase chưa đầy đủ')
      stopScanning()
      return
    }

    try {
      // Parse QR code data
      let qrData: any
      try {
        qrData = JSON.parse(decodedText)
      } catch (parseError) {
        throw new Error('QR code không hợp lệ. Vui lòng quét lại.')
      }

      // Validate QR code structure
      if (!qrData.id) {
        throw new Error('QR code thiếu thông tin định danh')
      }
      
      // Fetch registration from database
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', qrData.id)
        .single()

      if (error || !data) {
        throw new Error('Không tìm thấy thông tin khách hàng trong hệ thống')
      }

      // Verify QR code data matches database (security check)
      const verificationErrors: string[] = []
      
      if (qrData.email && qrData.email.toLowerCase() !== data.email.toLowerCase()) {
        verificationErrors.push('Email không khớp')
      }
      
      if (qrData.name && qrData.name.trim() !== data.name.trim()) {
        verificationErrors.push('Tên không khớp')
      }
      
      if (qrData.phone && qrData.phone !== data.phone) {
        verificationErrors.push('Số điện thoại không khớp')
      }

      // If there are verification errors but data exists, show warning but still display
      if (verificationErrors.length > 0) {
        console.warn('QR code verification warnings:', verificationErrors)
        // Still show data but mark as potentially invalid
        setCustomerInfo({ ...data, verificationWarnings: verificationErrors })
      } else {
        // All checks passed
        setCustomerInfo(data)
      }
      
      setError(null)
      stopScanning()
    } catch (err: any) {
      setError('Không thể đọc thông tin từ QR code: ' + (err.message || 'Đã xảy ra lỗi'))
      console.error(err)
      stopScanning()
    }
  }

  const handleManualInput = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!isConfigured) {
      setError('Cấu hình Supabase chưa đầy đủ')
      return
    }

    const formData = new FormData(e.currentTarget)
    const qrDataInput = formData.get('qrData') as string

    try {
      // Parse QR code data
      let parsed: any
      try {
        parsed = JSON.parse(qrDataInput)
      } catch (parseError) {
        throw new Error('Dữ liệu QR code không hợp lệ. Vui lòng kiểm tra lại.')
      }

      if (!parsed.id) {
        throw new Error('QR code thiếu thông tin định danh')
      }

      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', parsed.id)
        .single()

      if (error || !data) {
        throw new Error('Không tìm thấy thông tin khách hàng trong hệ thống')
      }

      // Verify QR code data matches database
      const verificationErrors: string[] = []
      
      if (parsed.email && parsed.email.toLowerCase() !== data.email.toLowerCase()) {
        verificationErrors.push('Email không khớp')
      }
      
      if (parsed.name && parsed.name.trim() !== data.name.trim()) {
        verificationErrors.push('Tên không khớp')
      }
      
      if (parsed.phone && parsed.phone !== data.phone) {
        verificationErrors.push('Số điện thoại không khớp')
      }

      if (verificationErrors.length > 0) {
        console.warn('QR code verification warnings:', verificationErrors)
        setCustomerInfo({ ...data, verificationWarnings: verificationErrors })
      } else {
        setCustomerInfo(data)
      }
      
      setError(null)
    } catch (err: any) {
      setError('Không thể đọc thông tin: ' + (err.message || 'Đã xảy ra lỗi'))
      console.error(err)
    }
  }

  const handleLogout = async () => {
    await logoutStaff()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-stripes md:bg-stripes-desktop text-black py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <Link
            href="/"
            className="text-black hover:text-gray-800 font-medium text-sm sm:text-base flex items-center gap-1"
          >
            <span className="text-lg">←</span> Quay lại danh sách
          </Link>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {staffEmail && (
              <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[200px] sm:max-w-none">
                {staffEmail}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2.5 sm:py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:bg-gray-800 transition-colors text-sm font-medium w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-4 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">Quét QR Code khách hàng</h1>

          {!scanning && !customerInfo && (
            <div className="space-y-4">
              <button
                onClick={startScanning}
                className="w-full px-6 py-4 bg-black text-white rounded-md hover:bg-gray-800 active:bg-gray-900 transition-colors font-medium text-base sm:text-lg min-h-[56px] touch-manipulation"
              >
                Bắt đầu quét QR Code
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Hoặc nhập thủ công</span>
                </div>
              </div>

              <form onSubmit={handleManualInput} className="space-y-4">
                <textarea
                  name="qrData"
                  placeholder="Dán dữ liệu QR code ở đây (JSON format)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent font-mono text-sm bg-white text-black min-h-[120px] resize-y"
                  rows={4}
                />
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium min-h-[48px] touch-manipulation"
                >
                  Tìm kiếm
                </button>
              </form>
            </div>
          )}

          {scanning && (
            <div className="space-y-4">
              <div id={qrCodeRegionId} className="w-full min-h-[300px] sm:min-h-[400px] rounded-md overflow-hidden"></div>
              <button
                onClick={stopScanning}
                className="w-full px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 active:bg-red-800 transition-colors font-medium min-h-[48px] touch-manipulation"
              >
                Dừng quét
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {customerInfo && (
            <div className={`mt-4 sm:mt-6 p-4 sm:p-6 rounded-md border-2 ${
              customerInfo.verificationWarnings && customerInfo.verificationWarnings.length > 0
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-green-50 border-green-200'
            }`}>
              {customerInfo.verificationWarnings && customerInfo.verificationWarnings.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Cảnh báo xác thực:</p>
                      <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                        {customerInfo.verificationWarnings.map((warning: string, index: number) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2 sm:gap-0">
                <h2 className="text-xl sm:text-2xl font-bold text-black">Thông tin khách hàng</h2>
                {(!customerInfo.verificationWarnings || customerInfo.verificationWarnings.length === 0) && (
                  <div className="flex items-center text-green-600">
                    <svg className="w-5 h-5 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium whitespace-nowrap">Đã xác thực</span>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-md p-4 mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Họ và tên</span>
                    <p className="text-lg font-semibold text-black mt-1">{customerInfo.name}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</span>
                    <p className="text-lg text-black mt-1 break-all">{customerInfo.email}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Số điện thoại</span>
                    <p className="text-lg text-black mt-1">{customerInfo.phone}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày workshop</span>
                    <p className="text-lg text-black mt-1">
                      {(() => {
                        const workshopDate = customerInfo.workshop_date ? new Date(customerInfo.workshop_date) : null
                        // Check if date is invalid or is epoch date (1970-01-01)
                        const isValidDate = workshopDate && !isNaN(workshopDate.getTime()) && workshopDate.getFullYear() > 1970
                        const displayDate = isValidDate ? workshopDate : new Date('2025-12-28')
                        return displayDate.toLocaleDateString('vi-VN', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      })()}
                    </p>
                  </div>
                  {customerInfo.seat_number && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ghế ngồi</span>
                      <p className="mt-1">
                        <span className="inline-flex items-center px-4 py-2 rounded-full text-base font-bold bg-gray-100 text-gray-800">
                          Ghế {customerInfo.seat_number}
                        </span>
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</span>
                    <p className="mt-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        customerInfo.payment_status === 'sent' 
                          ? 'bg-green-100 text-green-800'
                          : customerInfo.payment_status === 'verified'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {customerInfo.payment_status === 'sent' ? 'Đã gửi QR' : 
                         customerInfo.payment_status === 'verified' ? 'Đã xác nhận' : 'Chờ thanh toán'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã đăng ký</span>
                  <p className="text-sm text-gray-600 mt-1 font-mono">{customerInfo.id}</p>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mt-3">Đăng ký lúc</span>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(customerInfo.created_at).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setCustomerInfo(null)
                    setError(null)
                  }}
                  className="flex-1 px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 active:bg-gray-900 transition-colors font-medium min-h-[48px] touch-manipulation"
                >
                  Quét lại
                </button>
                <button
                  onClick={() => {
                    window.print()
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium min-h-[48px] touch-manipulation"
                >
                  In thông tin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

