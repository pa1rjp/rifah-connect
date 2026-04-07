import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Authorization': `token ${import.meta.env.VITE_API_KEY}:${import.meta.env.VITE_API_SECRET}`,
    'Content-Type': 'application/json',
  },
})

export default api
