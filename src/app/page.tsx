'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Mic, Sun, Moon, Trash2 } from 'lucide-react'
import { Switch } from "@/components/ui/switch"

export default function Component() {
  const [chatHistory, setChatHistory] = useState([])
  const [textInput, setTextInput] = useState('')
  const [preferenceInput, setPreferenceInput] = useState('')
  const [personalities, setPersonalities] = useState([])
  const [currentPersonality, setCurrentPersonality] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState('')
  const [characters, setCharacters] = useState({})
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isDarkTheme, setIsDarkTheme] = useState(false)
  const [isHorizontal, setIsHorizontal] = useState(false)
  const router = useRouter()
  const videoRef = useRef(null)
  const recognitionRef = useRef(null)

  const videoUrls = [
    "https://cdn.glitch.global/d02f8f67-1720-48fe-907d-c70042503ba5/coffee_woman_ai_resting.mp4?v=1713548715874",
    "https://cdn.glitch.global/d02f8f67-1720-48fe-907d-c70042503ba5/coffee_woman_ai.mp4?v=1713548711063",
  ]

  const API_BASE_URL = "http://localhost:5000"

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    fetchPersonalities(token)
    fetchCurrentPersonality(token)
    fetchCharacters(token)
    initializeSpeechRecognition()
    loadInitialChatHistory(token)

    const handleResize = () => {
      setIsHorizontal(window.innerWidth > window.innerHeight)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [router])

  const initializeSpeechRecognition = () => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.lang = 'en-US'
      recognitionRef.current.interimResults = false
      recognitionRef.current.maxAlternatives = 1

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setTextInput(transcript)
        handleSubmit(transcript)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
  }

  const fetchPersonalities = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-all-personalities`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data && data.length > 0) {
        setPersonalities(data)
      } else {
        setPersonalities(['Friendly', 'Professional', 'Humorous', 'Sarcastic', 'Empathetic'])
      }
    } catch (error) {
      console.error('Error fetching personalities:', error)
      setPersonalities(['Friendly', 'Professional', 'Humorous', 'Sarcastic', 'Empathetic'])
    }
  }

  const fetchCurrentPersonality = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-current-user-gf-personality`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data && data.ai_personality) {
        setCurrentPersonality(data.ai_personality)
      }
    } catch (error) {
      console.error('Error fetching current user personality:', error)
    }
  }

  const fetchCharacters = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-all-characters`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.length > 0) {
        const characterMap = data.reduce((acc, char) => {
          acc[char] = `https://example.com/${char.toLowerCase().replace(' ', '_')}.mp4`
          return acc
        }, {})
        setCharacters(characterMap)
        setSelectedCharacter(data[0])
      } else {
        setDefaultCharacters()
      }
    } catch (error) {
      console.error("Error fetching characters:", error)
      setDefaultCharacters()
    }
  }

  const setDefaultCharacters = () => {
    const placeholderCharacters = {
      'Coffee Woman': videoUrls[0],
      'Office Man': 'https://example.com/office_man.mp4',
      'Student': 'https://example.com/student.mp4'
    }
    setCharacters(placeholderCharacters)
    setSelectedCharacter('Coffee Woman')
  }

  const loadInitialChatHistory = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data && data.history) {
        setChatHistory(data.history.map(msg => ({
          type: msg.role === 'user' ? 'user' : 'bot',
          text: msg.content
        })))
      }
    } catch (error) {
      console.error("Failed to load history:", error)
    }
  }

  const handleSubmit = async (input = textInput) => {
    if (input.trim() && !isAISpeaking) {
      setChatHistory(prev => [...prev, { type: 'user', text: input }])
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${API_BASE_URL}/api/generate-lipsync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            text_prompt: input,
            input_face: videoUrls[characters[selectedCharacter] ? 1 : 0],
            extra_prompt: "Previous conversation for context:" + chatHistory.map(msg => `{${msg.text}}`).join('') + "Don't break character; you are as the character as defined\nLimit your answer to be less than 50 words...",
            characterName: selectedCharacter,
            ai_personality: currentPersonality,
            sessionId: Math.random().toString(36).substr(2),
          })
        })
        const data = await response.json()
        console.log("Server response:", data) // Log the entire response
        if (data.chatGptResponse) {
          setChatHistory(prev => [...prev, { type: 'bot', text: data.chatGptResponse }])
          if (data.audio_id) {
            handleAISpeech(data.audio_id)
          } else {
            console.error("No audio_id received from the server")
          }
        } else {
          console.error("No chatGptResponse in the server response")
        }
      } catch (error) {
        console.error("Error generating response:", error)
        setChatHistory(prev => [...prev, { type: 'bot', text: "Sorry, I couldn't process that request." }])
      }
      setTextInput('')
    }
  }

  const handleAISpeech = async (audioId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/audio/${audioId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      console.log("Playing audio from URL:", audioUrl)
      const audioPlayer = new Audio(audioUrl)

      audioPlayer.addEventListener('loadedmetadata', () => {
        console.log("Audio metadata loaded")
      })

      audioPlayer.addEventListener('play', () => {
        console.log("Audio playback started")
        setIsAISpeaking(true)
        updateVideoSource(videoUrls[1])
      })

      audioPlayer.addEventListener('ended', () => {
        console.log("Audio playback ended")
        setIsAISpeaking(false)
        updateVideoSource(videoUrls[0])
        URL.revokeObjectURL(audioUrl) // Clean up the object URL
      })

      audioPlayer.addEventListener('error', (e) => {
        console.error("Audio playback error:", e)
        setIsAISpeaking(false)
        updateVideoSource(videoUrls[0])
        URL.revokeObjectURL(audioUrl) // Clean up the object URL
      })

      await audioPlayer.play()
    } catch (error) {
      console.error('Audio playback failed:', error)
      setIsAISpeaking(false)
    }
  }

  const updateVideoSource = (newSrc) => {
    if (videoRef.current) {
      videoRef.current.src = newSrc
      videoRef.current.load()
      videoRef.current.play()
    }
  }

  const handlePreferenceSubmit = async () => {
    if (preferenceInput.trim()) {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${API_BASE_URL}/api/add-personality`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            name: "Custom",
            personality: preferenceInput
          })
        })
        const data = await response.json()
        alert(data.message)
        setPreferenceInput('')
        fetchPersonalities(token)
      } catch (error) {
        console.error("Error submitting preference:", error)
        alert("Failed to submit preference. Please try again.")
      }
    }
  }

  const handlePersonalityChange = async (value: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/change-personality`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ai_personality: value })
      })
      const data = await response.json()
      if (data.success) {
        setCurrentPersonality(value)
        alert(data.message)
      } else {
        alert("Error: " + data.message)
      }
    } catch (error) {
      console.error("Error changing personality:", error)
      alert("Failed to change personality. Please try again.")
    }
  }

  const handleCharacterChange = async (value: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/change-character`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ characterName: value })
      })
      const data = await response.json()
      if (data.success) {
        setSelectedCharacter(value)
        updateVideoSource(characters[value])
        alert(data.message)
      } else {
        alert("Error: " + data.message)
      }
    } catch (error) {
      console.error("Error changing character:", error)
      alert("Failed to change character. Please try again.")
    }
  }

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme)
  }

  const clearHistory = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/clear-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setChatHistory([])
        alert("Chat history cleared successfully!")
      } else {
        alert("Failed to clear chat history. Please try again.")
      }
    } catch (error) {
      console.error("Error clearing history:", error)
      alert("An error occurred while clearing chat history.")
    }
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isDarkTheme ? 'bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
      <header className={`${isDarkTheme ? 'bg-gray-800' : 'bg-white'} shadow-md p-4`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI-GF</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4" />
              <Switch checked={isDarkTheme} onCheckedChange={toggleTheme} />
              <Moon className="h-4 w-4" />
            </div>
            <Button variant="outline" onClick={() => {
              localStorage.removeItem('token')
              router.push('/login')
            }}>Logout</Button>
          </div>
        </div>
      </header>

      <main className={`flex-grow flex ${isHorizontal ? 'flex-row' : 'flex-col'} items-stretch p-6 gap-6 overflow-hidden`}>
        <Card className={`${isHorizontal ? 'w-6/10' : 'w-full'} overflow-hidden`}>
          <CardContent className="p-0 h-full flex items-center justify-center">
            <div className="aspect-video h-full flex items-center justify-center overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay loop muted>
                <source src={characters[selectedCharacter] ||
                  videoUrls[0]} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </CardContent>
        </Card>

        <Card className={`${isHorizontal ? 'w-[calc(50%)]' : 'w-full'} ${isDarkTheme ? 'bg-gray-800' : 'bg-white'} shadow-xl flex flex-col overflow-hidden`}>
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex-grow overflow-y-auto mb-6 border rounded-lg p-4" style={{ maxHeight: 'calc(100% - 200px)' }}>
              {chatHistory.map((message, index) => (
                <div key={index} className={`p-2 rounded-lg mb-2 ${message.type === 'user' ? (isDarkTheme ? 'bg-blue-900' : 'bg-blue-100') + ' text-right' : isDarkTheme ? 'bg-green-900' : 'bg-green-100'}`}>
                  {message.text}
                </div>
              ))}
            </div>

            <div className="flex mb-4">
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type here to talk to avatar"
                className={`flex-grow mr-2 ${isDarkTheme ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'}`}
              />
              <Button onClick={() => handleSubmit()} disabled={isAISpeaking || !textInput.trim()}>Submit</Button>
              <Button
                className={`ml-2 ${isListening ? 'bg-red-600' : 'bg-blue-600'}`}
                onClick={toggleVoiceInput}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex mb-4">
              <Textarea
                value={preferenceInput}
                onChange={(e) => setPreferenceInput(e.target.value)}
                placeholder="Type your preference here, in key-value form(e.g. Fav.city: nyc)"
                className={`flex-grow mr-2 ${isDarkTheme ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'}`}
              />
              <Button onClick={handlePreferenceSubmit}>Submit Preference</Button>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Select onValueChange={handlePersonalityChange} value={currentPersonality}>
                  <SelectTrigger className={`w-[180px] ${isDarkTheme ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
                    <SelectValue placeholder="Select personality" />
                  </SelectTrigger>
                  <SelectContent className={isDarkTheme ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'}>
                    {personalities.map((personality) => (
                      <SelectItem key={personality} value={personality}>
                        {personality}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="ml-2">Change Personality</Button>
              </div>

              <div className="flex items-center">
                <Select onValueChange={handleCharacterChange} value={selectedCharacter}>
                  <SelectTrigger className={`w-[180px] ${isDarkTheme ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'}`}>
                    <SelectValue placeholder="Select character" />
                  </SelectTrigger>
                  <SelectContent className={isDarkTheme ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'}>
                    {Object.keys(characters).map((character) => (
                      <SelectItem key={character} value={character}>
                        {character}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="ml-2">Change Character</Button>
              </div>

              <Button onClick={clearHistory} className="bg-red-500 hover:bg-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}