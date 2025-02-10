'use client'

import { useState } from 'react'

export default function Home() {
  const [username, setUsername] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmitUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('http://localhost:3001/initialize-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initialize chat')
      }
      setMessages([{ role: 'assistant', content: 'Hi! I\'m ready to chat as u/' + username }])
    } catch (error) {
      console.error(error)
      setError(error instanceof Error ? error.message : 'Failed to find that username')
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setMessages([])
    setUsername('')
    setCurrentMessage('')
    setError(null)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentMessage.trim()) return

    const newMessage = { role: 'user' as const, content: currentMessage }
    setMessages(prev => [...prev, newMessage])
    setCurrentMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: currentMessage, username }),
      })
      
      if (!response.ok) throw new Error('Failed to send message')
      
      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">RedditorChat</h1>
      
      {messages.length === 0 ? (
        <form onSubmit={handleSubmitUsername} className="max-w-md">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter Reddit username"
            className="w-full p-2 border rounded mb-4"
          />
          <button 
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
          >
            {isLoading ? 'Loading...' : 'Start Chat'}
          </button>
          {error && (
            <p className="mt-4 text-red-500">{error}</p>
          )}
        </form>
      ) : (
        <div className="max-w-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl">Chatting with u/{username}</h2>
            <button 
              onClick={handleReset}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back to user selection
            </button>
          </div>
          <div className="mb-4 h-[60vh] overflow-y-auto border rounded p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 ${
                  message.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                <div
                  className={`inline-block p-2 rounded ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
          
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 p-2 border rounded"
            />
            <button 
              type="submit"
              disabled={isLoading}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </main>
  )
}
