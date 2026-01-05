import { Box, Heading, VStack, Card, CardBody, Text, Badge, HStack, Avatar, Wrap, WrapItem, Grid, GridItem, Divider } from '@chakra-ui/react'

const posts = [
  { user:'@alice', avatar:'A', strategy:'Hybrid-TSI-SSL', roi:'+17.2%', likes:128 },
  { user:'@bob', avatar:'B', strategy:'ZeroLag-Break', roi:'+12.8%', likes:95 },
  { user:'@charlie', avatar:'C', strategy:'Range-Filter', roi:'+9.6%', likes:77 },
  { user:'@dave', avatar:'D', strategy:'QQE-Mod', roi:'+8.3%', likes:64 },
]

export default function Community(){
  const news = [
    { title:'美联储暗示放缓加息', time:'2h前', brief:'鲍威尔讲话释放鸽派信号，市场押注年内降息。' },
    { title:'英伟达盘后大涨 8%', time:'3h前', brief:'数据中心收入超预期，AI 芯片需求持续火热。' },
    { title:'黄金突破 2100 美元', time:'5h前', brief:'地缘风险升温，避险资金涌入贵金属。' },
    { title:'A50 期货夜盘拉升', time:'6h前', brief:'外资回流中国资产，北向资金单日净买 120 亿。' },
    { title:'OPEC+ 延长减产', time:'8h前', brief:'油价短线跳涨 2%，供应端收紧预期强化。' },
  ]
  return (
    <Box px={8} py={6}>
      <Grid templateColumns={{ base:'1fr', md:'2fr 1fr' }} gap={8} alignItems="flex-start">
        {/* 左侧 2/3：策略榜 */}
        <GridItem>
          <VStack spacing={6} align="stretch">
            <Heading size="xl" fontWeight={700} letterSpacing="-0.5px" lineHeight="110%">社区策略榜</Heading>

            <Wrap spacing={3}>
              <WrapItem><Badge colorScheme="success" borderRadius="full" px={3} py={1}>趋势</Badge></WrapItem>
              <WrapItem><Badge colorScheme="blue" borderRadius="full" px={3} py={1}>高频</Badge></WrapItem>
              <WrapItem><Badge colorScheme="purple" borderRadius="full" px={3} py={1}>套利</Badge></WrapItem>
              <WrapItem><Badge colorScheme="orange" borderRadius="full" px={3} py={1}>稳健</Badge></WrapItem>
              <WrapItem><Badge colorScheme="pink" borderRadius="full" px={3} py={1}>AI</Badge></WrapItem>
            </Wrap>

            <Card w="full">
              <CardBody>
                <HStack spacing={4}>
                  <Avatar size="md" name="Star" />
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="bold">本周之星</Text>
                    <Text fontSize="sm" color="fgMuted">@star_trader</Text>
                  </VStack>
                  <Badge colorScheme="success" ml="auto" fontSize="md">+28.5%</Badge>
                </HStack>
              </CardBody>
            </Card>

            <VStack spacing={4}>
              {posts.sort((a,b)=> parseFloat(b.roi) - parseFloat(a.roi)).map((p,i)=> (
                <Card key={i} w="full">
                  <CardBody>
                    <HStack justify="space-between" w="full">
                      <HStack spacing={4}>
                        <Avatar name={p.avatar} size="sm" />
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold">{p.user}</Text>
                          <Text fontSize="sm" color="fgMuted">{p.strategy}</Text>
                        </VStack>
                      </HStack>
                      <HStack spacing={4}>
                        <Badge colorScheme="success" fontSize="md">{p.roi}</Badge>
                        <Text fontSize="sm" color="fgMuted">👍 {p.likes}</Text>
                      </HStack>
                    </HStack>
                  </CardBody>
                </Card>
              ))}
            </VStack>
          </VStack>
        </GridItem>

        {/* 右侧 1/3：AI 精选快讯 */}
        <GridItem>
          <VStack spacing={6} align="stretch">
            <Heading size="lg" fontWeight={700} letterSpacing="-0.5px">AI 精选快讯</Heading>
            <VStack spacing={4}>
              {news.map((n,i)=> (
                <Card key={i} w="full" borderRadius="16px">
                  <CardBody>
                    <VStack align="start" spacing={2}>
                      <HStack justify="space-between" w="full">
                        <Text fontWeight="bold" fontSize="md" noOfLines={1}>{n.title}</Text>
                        <Text fontSize="xs" color="fgMuted">{n.time}</Text>
                      </HStack>
                      <Text fontSize="sm" color="fgMuted" noOfLines={2}>{n.brief}</Text>
                    </VStack>
                  </CardBody>
                </Card>
              ))}
            </VStack>
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  )
}