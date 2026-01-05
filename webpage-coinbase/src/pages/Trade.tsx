import { Box, Heading, Text, VStack, HStack, Badge, Button, Flex, Card, CardBody, Stat, StatLabel, StatNumber, StatHelpText, StatArrow } from '@chakra-ui/react'
import { createChart, ColorType } from 'lightweight-charts'
import { useEffect, useRef } from 'react'

export default function Trade(){
  const chartContainer = useRef<HTMLDivElement | null>(null)

  useEffect(()=>{
    if(!chartContainer.current) return
    const chart = createChart(chartContainer.current,{
      width: chartContainer.current.clientWidth,
      height: 420,
      layout:{ background:{ type:ColorType.Solid, color:'transparent' }, textColor:'#d1d9e6' },
      grid:{ vertLines:{ color:'rgba(255,255,255,0.06)' }, horzLines:{ color:'rgba(255,255,255,0.06)' } },
      crosshair:{ mode:1, vertLine:{ color:'rgba(255,255,255,0.2)', labelBackgroundColor:'#0052ff' }, horzLine:{ color:'rgba(255,255,255,0.2)', labelBackgroundColor:'#0052ff' } },
      rightPriceScale:{ borderColor:'rgba(255,255,255,0.08)', scaleMargins:{ top:0.1, bottom:0.2 } },
      timeScale:{ borderColor:'rgba(255,255,255,0.08)' }
    })
    const candle = chart.addCandlestickSeries({ upColor:'#26a69a', downColor:'#ef5350', borderVisible:false, wickUpColor:'#26a69a', wickDownColor:'#ef5350' })
    candle.setData([
      { time:'2024-01-01', open:92000, high:93500, low:91500, close:93000 },
      { time:'2024-01-02', open:93000, high:94000, low:92500, close:93500 },
      { time:'2024-01-03', open:93500, high:95000, low:93000, close:94500 },
      { time:'2024-01-04', open:94500, high:95500, low:94000, close:95000 },
      { time:'2024-01-05', open:95000, high:96000, low:94500, close:95500 },
      { time:'2024-01-06', open:95500, high:96500, low:95000, close:96000 },
      { time:'2024-01-07', open:96000, high:97000, low:95500, close:96500 },
      { time:'2024-01-08', open:96500, high:97500, low:96000, close:97000 },
      { time:'2024-01-09', open:97000, high:98000, low:96500, close:97500 },
      { time:'2024-01-10', open:97500, high:98500, low:97000, close:98000 },
    ])
    chart.timeScale().fitContent()
    return ()=> chart.remove()
  },[])

  return (
    <Box px={{ base:4, md:8 }} py={{ base:6, md:8 }}>
      <VStack spacing={{ base:6, md:8 }} align="stretch" maxW="1440px" mx="auto">
        <Heading size="xl" fontWeight={700} letterSpacing="-0.5px" lineHeight="110%">Trade</Heading>

        <Card p={0} overflow="hidden">
          <Flex justify="space-between" align="center" p={4} borderBottom="2px solid" borderColor="border">
            <HStack spacing={4}>
              <Badge colorScheme="success" variant="solid" borderRadius="6px">BTC/USDT</Badge>
              <Stat size="sm">
                <StatLabel>24h 变化</StatLabel>
                <StatNumber color="success">+1.99%</StatNumber>
              </Stat>
            </HStack>
            <HStack spacing={2}>
              <Button size="sm" variant="outline" borderRadius="10px">1m</Button>
              <Button size="sm" variant="outline" borderRadius="10px">5m</Button>
              <Button size="sm" variant="outline" borderRadius="10px">1h</Button>
              <Button size="sm" variant="outline" borderRadius="10px">4h</Button>
              <Button size="sm" variant="outline" borderRadius="10px">1d</Button>
            </HStack>
          </Flex>
          <Box p={2}><div ref={chartContainer} style={{ width:'100%', height:420 }} /></Box>
        </Card>

        <Card p={6}>
          <Heading size="md" mb={6} fontWeight={600}>主要加密货币</Heading>
          <HStack spacing={{ base:4, md:8 }} justify="space-between" flexWrap="wrap">
            <CryptoRow symbol="BTC" price="$92,981.50" change="+1.99%" volume="$32.8B" />
            <CryptoRow symbol="ETH" price="$3,191.41" change="+1.48%" volume="$15.8B" />
            <CryptoRow symbol="SOL" price="$136.79" change="+2.31%" volume="$3.3B" />
            <CryptoRow symbol="XRP" price="$2.14" change="+5.49%" volume="$3.5B" />
          </HStack>
        </Card>
      </VStack>
    </Box>
  )
}

function CryptoRow({ symbol, price, change, volume }: { symbol: string; price: string; change: string; volume: string }){
  const isUp = change.startsWith('+')
  return (
    <VStack align="start" spacing={1} minW={{ base:'140px', md:'160px' }}>
      <Text fontSize="sm" color="fgMuted">{symbol}</Text>
      <Text fontSize={{ base:'18px', md:'20px' }} fontWeight={700}>{price}</Text>
      <HStack spacing={2}>
        <Badge colorScheme={isUp ? 'success' : 'danger'} variant="subtle" borderRadius="6px">{change}</Badge>
        <Text fontSize="xs" color="fgMuted">Vol {volume}</Text>
      </HStack>
    </VStack>
  )
}