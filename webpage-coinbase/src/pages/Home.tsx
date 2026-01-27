import { Box, Heading, Text, VStack, HStack, Badge, Button, Flex, Card } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const bounce = { y: [0, -8, 0], transition: { duration: 1.2, repeat: Infinity, repeatType: 'reverse' } }

export default function Home(){
  return (
    <Box px={{ base:4, md:8 }} py={{ base:12, md:20 }}>
      <VStack spacing={{ base:10, md:16 }} align="start" maxW="1440px" mx="auto">
        <Flex direction={{ base:'column', md:'row' }} align="center" justify="space-between" w="full">
          <VStack align="start" spacing={6} flex={1}>
            <Heading
              fontSize={{ base:'32px', md:'56px' }}
              lineHeight="110%"
              letterSpacing="-1.5px"
              bg="linear-gradient(90deg, var(--chakra-colors-fg) 0%, #a0b4ff 100%)"
              bgClip="text"
            >
              探索加密世界
            </Heading>
            <Text fontSize={{ base:'16px', md:'20px' }} color="fgMuted" maxW="480px">
              在 Aspen 发现、交易与分享策略，让 AI 为你的资产保驾护航
            </Text>
            <HStack spacing={4}>
              <Link to="/trade">
                <Button colorScheme="brand" size="lg" px={8}>开始交易</Button>
              </Link>
              <Link to="/strategy">
                <Button variant="outline" size="lg" px={8}>浏览策略</Button>
              </Link>
            </HStack>
          </VStack>
          <Box flex={1} display={{ base:'none', md:'block' }}>
            <motion.div animate={bounce}>
              <Box w="320px" h="320px" bg="radial-gradient(circle, rgba(0,82,255,0.25) 0%, transparent 70%)" borderRadius="50%" />
            </motion.div>
          </Box>
        </Flex>

        <Card p={{ base:6, md:8 }}>
          <Heading size="xl" mb={6} fontWeight={700} letterSpacing="-0.5px">市场概览</Heading>
          <HStack spacing={{ base:4, md:8 }} justify="space-between" flexWrap="wrap">
            <MarketItem symbol="BTC" price="$92,981.50" change="+1.99%" />
            <MarketItem symbol="ETH" price="$3,191.41" change="+1.48%" />
            <MarketItem symbol="SOL" price="$136.79" change="+2.31%" />
            <MarketItem symbol="XRP" price="$2.14" change="+5.49%" />
          </HStack>
        </Card>
      </VStack>
    </Box>
  )
}

function MarketItem({ symbol, price, change }: { symbol: string; price: string; change: string }){
  const isUp = change.startsWith('+')
  return (
    <VStack align="start" spacing={1}>
      <Text fontSize="sm" color="fgMuted">{symbol}</Text>
      <Text fontSize={{ base:'20px', md:'24px' }} fontWeight={700}>{price}</Text>
      <Badge colorScheme={isUp ? 'success' : 'danger'} variant="subtle" borderRadius="6px" px={2} py={1}>{change}</Badge>
    </VStack>
  )
}