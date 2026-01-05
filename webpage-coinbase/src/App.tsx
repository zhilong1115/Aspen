import { Box } from '@chakra-ui/react'
import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import Home from './pages/Home'
import Trade from './pages/Trade'
import Strategy from './pages/Strategy'
import Community from './pages/Community'
import Profile from './pages/Profile'

export default function App(){
  return (
    <Box minH="100vh" bg="bg">
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/strategy" element={<Strategy />} />
        <Route path="/community" element={<Community />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Box>
  )
}