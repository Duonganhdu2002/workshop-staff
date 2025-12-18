'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured, type Registration } from '@/lib/supabase'
import { logoutStaff, getStaffEmailAsync } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type SeatStatus = 'available' | 'selected' | 'booked'

interface Seat {
  seat_number: number
  status: SeatStatus
  registration_id: string | null
  selected_by: string | null
  selected_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

interface SeatWithRegistration extends Seat {
  registration?: Registration | null
}

export default function SeatManagementPage() {
  const [seats, setSeats] = useState<SeatWithRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [assigningSeat, setAssigningSeat] = useState(false)
  const [staffEmail, setStaffEmail] = useState<string | null>(null)
  const router = useRouter()

  const isConfigured = isSupabaseConfigured()

  useEffect(() => {
    const loadEmail = async () => {
      const email = await getStaffEmailAsync()
      setStaffEmail(email)
    }
    loadEmail()
    if (isConfigured) {
      fetchSeats()
      fetchRegistrations()
      setupRealtimeSubscription()
    } else {
      setLoading(false)
      setError('Cấu hình Supabase chưa đầy đủ')
    }
  }, [isConfigured])

  const setupRealtimeSubscription = () => {
    if (!isConfigured) return

    const channel = supabase
      .channel('seats-management-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seats'
        },
        () => {
          fetchSeats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const fetchSeats = async () => {
    if (!isConfigured) {
      setError('Cấu hình Supabase chưa đầy đủ')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: seatsError } = await supabase
        .from('seats')
        .select('*')
        .order('seat_number', { ascending: true })

      if (seatsError) throw seatsError

      // Fetch registrations for booked seats
      const seatData = (data || []) as Seat[]
      const registrationIds = seatData
        .filter(s => s.registration_id)
        .map(s => s.registration_id!)
        .filter((id, index, self) => self.indexOf(id) === index)

      let registrationsMap: Record<string, Registration> = {}
      if (registrationIds.length > 0) {
        const { data: regData, error: regError } = await supabase
          .from('registrations')
          .select('*')
          .in('id', registrationIds)

        if (!regError && regData) {
          // Decrypt registration data before storing
          const { decryptRegistration } = await import('@/lib/security')
          const decryptedRegs = await Promise.all(
            regData.map((reg: any) => decryptRegistration(reg))
          )
          decryptedRegs.forEach(reg => {
            registrationsMap[reg.id] = reg
          })
        }
      }

      const seatsWithReg: SeatWithRegistration[] = seatData.map(seat => ({
        ...seat,
        registration: seat.registration_id ? registrationsMap[seat.registration_id] || null : null
      }))

      setSeats(seatsWithReg)
    } catch (err: any) {
      console.error('Error fetching seats:', err)
      setError('Lỗi khi tải danh sách ghế: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchRegistrations = async () => {
    if (!isConfigured) return

    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRegistrations(data || [])
    } catch (err: any) {
      console.error('Error fetching registrations:', err)
    }
  }

  const handleReleaseSeat = async (seatNumber: number) => {
    if (!isConfigured) {
      alert('Cấu hình Supabase chưa đầy đủ')
      return
    }

    try {
      // Update seat to available
      const { error: seatError } = await supabase
        .from('seats')
        .update({
          status: 'available',
          registration_id: null,
          selected_by: null,
          selected_at: null,
          expires_at: null
        })
        .eq('seat_number', seatNumber)

      if (seatError) throw seatError

      // Update registration to remove seat_number
      const seat = seats.find(s => s.seat_number === seatNumber)
      if (seat?.registration_id) {
        const { error: regError } = await supabase
          .from('registrations')
          .update({ seat_number: null })
          .eq('id', seat.registration_id)

        if (regError) {
          console.error('Error updating registration:', regError)
        }
      }

      await fetchSeats()
      setShowReleaseModal(false)
      setSelectedSeat(null)
      alert('Đã giải phóng ghế thành công!')
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    }
  }

  const handleCancelSelectedSeat = async (seatNumber: number) => {
    if (!isConfigured) {
      alert('Cấu hình Supabase chưa đầy đủ')
      return
    }

    try {
      // Update seat to available (cancel the selection)
      const { error: seatError } = await supabase
        .from('seats')
        .update({
          status: 'available',
          selected_by: null,
          selected_at: null,
          expires_at: null
        })
        .eq('seat_number', seatNumber)

      if (seatError) throw seatError

      await fetchSeats()
      setSelectedSeat(null)
      alert('Đã hủy ghế chờ thành công!')
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    }
  }

  const handleAssignSeat = async (registrationId: string) => {
    if (!isConfigured || !selectedSeat) {
      alert('Cấu hình Supabase chưa đầy đủ hoặc chưa chọn ghế')
      return
    }

    setAssigningSeat(true)
    try {
      // Check if registration already has a seat
      const registration = registrations.find(r => r.id === registrationId)
      if (!registration) {
        throw new Error('Không tìm thấy đăng ký')
      }

      // If registration has another seat, release it first
      if (registration.seat_number && registration.seat_number !== selectedSeat) {
        const { error: oldSeatError } = await supabase
          .from('seats')
          .update({
            status: 'available',
            registration_id: null,
            selected_by: null,
            selected_at: null,
            expires_at: null
          })
          .eq('seat_number', registration.seat_number)

        if (oldSeatError) {
          console.error('Error releasing old seat:', oldSeatError)
        }
      }

      // Check if selected seat is available
      const currentSeat = seats.find(s => s.seat_number === selectedSeat)
      if (currentSeat?.status === 'booked' && currentSeat.registration_id !== registrationId) {
        throw new Error('Ghế này đã được đặt bởi người khác')
      }

      // Update seat to booked
      const { error: seatError } = await supabase
        .from('seats')
        .update({
          status: 'booked',
          registration_id: registrationId,
          selected_by: null,
          selected_at: null,
          expires_at: null
        })
        .eq('seat_number', selectedSeat)

      if (seatError) throw seatError

      // Update registration with seat_number
      const { error: regError } = await supabase
        .from('registrations')
        .update({ seat_number: selectedSeat })
        .eq('id', registrationId)

      if (regError) throw regError

      await fetchSeats()
      setShowAssignModal(false)
      setSelectedSeat(null)
      alert('Đã gán ghế thành công!')
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setAssigningSeat(false)
    }
  }

  const handleLogout = () => {
    logoutStaff()
    router.push('/login')
    router.refresh()
  }

  const getSeatColor = (seat: SeatWithRegistration) => {
    if (seat.status === 'booked') {
      return 'bg-gray-600 cursor-pointer'
    }
    if (seat.status === 'selected') {
      return 'bg-blue-500 cursor-pointer'
    }
    return 'bg-green-600 cursor-pointer'
  }

  const renderSeats = () => {
    const rows = []
    let seatIndex = 0

    // 6 hàng đầu, mỗi hàng 7 ghế
    for (let row = 0; row < 6; row++) {
      const rowSeats = []
      for (let col = 0; col < 7; col++) {
        if (seatIndex < seats.length) {
          const seat = seats[seatIndex]
          rowSeats.push(
            <button
              key={seat.seat_number}
              onClick={() => setSelectedSeat(seat.seat_number)}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-md text-white font-semibold text-xs sm:text-sm transition-all ${getSeatColor(seat)} hover:opacity-80 active:opacity-70 touch-manipulation ${
                selectedSeat === seat.seat_number ? 'ring-2 ring-gray-400 ring-offset-1' : ''
              }`}
              title={`Ghế ${seat.seat_number} - ${seat.status === 'available' ? 'Trống' : seat.status === 'selected' ? 'Đang chọn' : 'Đã đặt'}${seat.registration ? ` - ${seat.registration.name}` : ''}`}
            >
              {seat.seat_number}
            </button>
          )
          seatIndex++
        }
      }
      rows.push(
        <div key={row} className="flex gap-2 justify-center">
          {rowSeats}
        </div>
      )
    }

    // Hàng cuối: 1 ghế
    if (seatIndex < seats.length) {
      const seat = seats[seatIndex]
      rows.push(
        <div key={6} className="flex gap-2 justify-center">
          <button
            key={seat.seat_number}
            onClick={() => setSelectedSeat(seat.seat_number)}
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-md text-white font-semibold text-xs sm:text-sm transition-all ${getSeatColor(seat)} hover:opacity-80 active:opacity-70 touch-manipulation ${
              selectedSeat === seat.seat_number ? 'ring-2 ring-gray-400 ring-offset-1' : ''
            }`}
            title={`Ghế ${seat.seat_number} - ${seat.status === 'available' ? 'Trống' : seat.status === 'selected' ? 'Đang chọn' : 'Đã đặt'}${seat.registration ? ` - ${seat.registration.name}` : ''}`}
          >
            {seat.seat_number}
          </button>
        </div>
      )
    }

    return rows
  }

  const selectedSeatData = selectedSeat ? seats.find(s => s.seat_number === selectedSeat) : null

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-stripes md:bg-stripes-desktop text-black py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-md border border-gray-200 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-black mb-4">Cấu hình thiếu</h1>
              <p className="text-gray-600 mb-6">
                Ứng dụng chưa được cấu hình đầy đủ. Vui lòng tạo file <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> với các biến môi trường cần thiết.
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
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Quản lý Ghế Ngồi</h1>
            <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
              Quản lý và theo dõi trạng thái ghế ngồi
              {staffEmail && (
                <span className="ml-2 text-xs sm:text-sm text-gray-500 block sm:inline">• {staffEmail}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              href="/"
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] sm:min-h-0 touch-manipulation text-center"
            >
              Quản lý Đăng ký
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
                  onClick={fetchSeats}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Thử lại
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Sơ đồ ghế */}
          <div className="lg:col-span-2 bg-white rounded-md border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-black mb-3 sm:mb-4">Sơ đồ Ghế</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                <p className="mt-4 text-gray-600">Đang tải...</p>
              </div>
            ) : (
              <>
                {/* Màn hình giả */}
                <div className="bg-black rounded-md p-4 mb-4 text-center">
                  <p className="text-white text-sm font-medium">SÂN KHẤU</p>
                </div>

                {/* Sơ đồ ghế */}
                <div className="space-y-1.5 sm:space-y-2 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  {renderSeats()}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 sm:gap-4 justify-center text-xs sm:text-sm mt-4 sm:mt-6">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-600 rounded"></div>
                    <span>Trống</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500 rounded"></div>
                    <span>Đang chọn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-600 rounded"></div>
                    <span>Đã đặt</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Thông tin ghế và thao tác */}
          <div className="bg-white rounded-md border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-black mb-3 sm:mb-4">
              {selectedSeat ? `Ghế ${selectedSeat}` : 'Chọn một ghế'}
            </h2>

            {selectedSeatData ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${getSeatColor(selectedSeatData)}`}></div>
                    <span className="text-sm text-gray-900 capitalize">
                      {selectedSeatData.status === 'available' ? 'Trống' : 
                       selectedSeatData.status === 'selected' ? 'Đang chọn' : 'Đã đặt'}
                    </span>
                  </div>
                </div>

                {selectedSeatData.registration ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Thông tin đăng ký</label>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div>
                        <span className="text-xs text-gray-500">Tên:</span>
                        <p className="text-sm font-medium text-gray-900">{selectedSeatData.registration.name}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Email:</span>
                        <p className="text-sm text-gray-900">{selectedSeatData.registration.email}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">SĐT:</span>
                        <p className="text-sm text-gray-900">{selectedSeatData.registration.phone}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Trạng thái thanh toán:</span>
                        <p className="text-sm text-gray-900">
                          {selectedSeatData.registration.payment_status === 'pending' ? 'Chờ thanh toán' :
                           selectedSeatData.registration.payment_status === 'verified' ? 'Đã xác nhận' : 'Đã gửi QR'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Thông tin đăng ký</label>
                    <p className="text-sm text-gray-500">Chưa có đăng ký</p>
                  </div>
                )}

                {selectedSeatData.status === 'selected' && (
                  <>
                    {selectedSeatData.selected_by && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Đang chọn bởi</label>
                        <p className="text-sm text-gray-900">{selectedSeatData.selected_by}</p>
                      </div>
                    )}
                    {selectedSeatData.selected_at && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian chọn</label>
                        <p className="text-sm text-gray-900">
                          {new Date(selectedSeatData.selected_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    )}
                    {selectedSeatData.expires_at && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hết hạn lúc</label>
                        <p className="text-sm text-gray-900">
                          {new Date(selectedSeatData.expires_at).toLocaleString('vi-VN')}
                        </p>
                        {new Date(selectedSeatData.expires_at) < new Date() && (
                          <p className="text-xs text-red-600 mt-1">⚠️ Đã hết hạn</p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {selectedSeatData.status === 'booked' && selectedSeatData.selected_by && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đang chọn bởi</label>
                    <p className="text-sm text-gray-900">{selectedSeatData.selected_by}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 space-y-2">
                  {selectedSeatData.status === 'booked' ? (
                    <button
                      onClick={() => {
                        if (selectedSeat && confirm('Bạn có chắc muốn giải phóng ghế này? Điều này sẽ xóa liên kết với đăng ký.')) {
                          handleReleaseSeat(selectedSeat)
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 active:bg-red-800 transition-colors font-medium min-h-[44px] touch-manipulation"
                    >
                      Giải phóng ghế
                    </button>
                  ) : selectedSeatData.status === 'selected' ? (
                    <>
                      <button
                        onClick={() => {
                          if (selectedSeat && confirm('Bạn có chắc muốn hủy ghế chờ này? Khách sẽ mất quyền giữ chỗ.')) {
                            handleCancelSelectedSeat(selectedSeat)
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 active:bg-orange-800 transition-colors font-medium min-h-[44px] touch-manipulation"
                      >
                        Hủy ghế chờ
                      </button>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="w-full px-4 py-2.5 bg-black text-white rounded-md hover:bg-gray-800 active:bg-gray-900 transition-colors font-medium min-h-[44px] touch-manipulation"
                      >
                        Gán ghế cho đăng ký
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="w-full px-4 py-2.5 bg-black text-white rounded-md hover:bg-gray-800 active:bg-gray-900 transition-colors font-medium min-h-[44px] touch-manipulation"
                    >
                      Gán ghế cho đăng ký
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Vui lòng chọn một ghế để xem thông tin và thực hiện thao tác</p>
            )}
          </div>
        </div>

        {/* Thống kê */}
        <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-md border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Tổng số ghế</p>
                <p className="text-xl sm:text-2xl font-bold text-black">{seats.length}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Ghế trống</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">
                  {seats.filter(s => s.status === 'available').length}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-md flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Ghế đang chờ</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">
                  {seats.filter(s => s.status === 'selected').length}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-md flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-md border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Ghế đã đặt</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-600">
                  {seats.filter(s => s.status === 'booked').length}
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal gán ghế */}
      {showAssignModal && selectedSeat && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md border border-gray-200 max-w-md w-full animate-zoom-in max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-6 flex-shrink-0">
              <h3 className="text-lg font-semibold text-black mb-4">
                Gán ghế {selectedSeat} cho đăng ký
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-2">
                {registrations.length === 0 ? (
                  <p className="text-sm text-gray-500">Không có đăng ký nào</p>
                ) : (
                  registrations.map(reg => (
                    <button
                      key={reg.id}
                      onClick={() => handleAssignSeat(reg.id)}
                      disabled={assigningSeat}
                      className="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[60px]"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-black">{reg.name}</p>
                          <p className="text-sm text-gray-600">{reg.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {reg.seat_number ? `Ghế hiện tại: ${reg.seat_number}` : 'Chưa có ghế'}
                          </p>
                        </div>
                        {assigningSeat && (
                          <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="p-4 sm:p-6 pt-0 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setAssigningSeat(false)
                }}
                className="w-full px-4 py-2.5 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 active:bg-gray-400 transition-colors font-medium min-h-[44px] touch-manipulation"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


