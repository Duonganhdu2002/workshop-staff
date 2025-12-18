'use client'

import { useEffect, useState } from 'react'

export default function TestEmailPage() {
  const [emailHTML, setEmailHTML] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch email template from API
    fetch('/api/test-email')
      .then(res => res.json())
      .then(data => {
        if (data.html) {
          setEmailHTML(data.html)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading email template:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-lg">Đang tải email template...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <h1 className="text-2xl font-bold mb-4">Email Template Preview</h1>
          <p className="text-gray-600 mb-4">
            Đây là preview của email template. Bạn có thể kiểm tra giao diện và layout.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <iframe
            srcDoc={emailHTML}
            className="w-full border-0"
            style={{ minHeight: '800px' }}
            title="Email Template Preview"
          />
        </div>
      </div>
    </div>
  )
}




