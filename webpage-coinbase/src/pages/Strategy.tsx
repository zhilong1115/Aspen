import { Box, Heading, SimpleGrid, Card, CardBody, Text, Badge, VStack, HStack, Button, Stat, StatLabel, StatNumber, StatHelpText } from '@chakra-ui/react'

const strategies = [
  { name:'Hybrid-TSI-SSL', roi:17.2, risk:'中', desc:'4h/30m TSI+SSL共振', followers:1280, trades:342 },
  { name:'ZeroLag-Break', roi:12.8, risk:'高', desc:'零滞后突破策略', followers:950, trades:218 },
  { name:'Range-Filter', roi:9.6, risk:'低', desc:'区间过滤趋势', followers:770, trades:156 },
  { name:'QQE-Mod', roi:8.3, risk:'中', desc:'平滑RSI信号', followers:640, trades:123 },
]

export default function Strategy(){
  return (
    <Box px={{ base:4, md:8 }} py={{ base:6, md:8 }}>
      <VStack spacing={{ base:6, md:8 }} align="stretch" maxW="1440px" mx="auto">
        <Heading size="xl" fontWeight={700} letterSpacing="-0.5px" lineHeight="110%">AI 策略</Heading>
        <SimpleGrid columns={{ base:1, md:2, lg:3 }} spacing={6}>
          {strategies.map((s,i)=> (
            <Card key={i}>
              <CardBody>
                <VStack align="start" spacing={4}>
                  <HStack justify="space-between" w="full">
                    <Text fontWeight={700} fontSize="lg">{s.name}</Text>
                    <Badge colorScheme="success" variant="solid" borderRadius="8px" px={3} py={1}>
                      +{s.roi}%
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="fgMuted">{s.desc}</Text>
                  <HStack spacing={6}>
                    <Stat size="sm">
                      <StatLabel>跟随者</StatLabel>
                      <StatNumber>{s.followers}</StatNumber>
                    </Stat>
                    <Stat size="sm">
                      <StatLabel>交易数</StatLabel>
                      <StatNumber>{s.trades}</StatNumber>
                    </Stat>
                  </HStack>
                  <HStack justify="space-between" w="full" mt={4}>
                    <Badge variant="outline" borderRadius="6px">风险 {s.risk}</Badge>
                    <Button size="sm" colorScheme="brand" borderRadius="12px">查看详情</Button>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </VStack>
    </Box>
  )
}