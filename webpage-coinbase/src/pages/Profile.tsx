import { Box, Heading, VStack, Card, CardBody, Text, Avatar, HStack, Badge, Button, IconButton, useColorMode } from '@chakra-ui/react'
import { SunIcon, MoonIcon } from '@chakra-ui/icons'

export default function Profile(){
  const { colorMode, toggleColorMode } = useColorMode()
  return (
    <Box px={8} py={6}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between" w="full">
          <Heading size="xl" fontWeight={700} letterSpacing="-0.5px" lineHeight="110%">个人中心</Heading>
          <IconButton
            aria-label="切换主题"
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            variant="ghost"
            borderRadius="12px"
          />
        </HStack>
        <Card>
          <CardBody>
            <HStack spacing={6}>
              <Avatar size="xl" name="U" />
              <VStack align="start" spacing={2}>
                <Text fontSize="xl" fontWeight="bold">@username</Text>
                <HStack>
                  <Badge colorScheme="brand">Lv.7</Badge>
                  <Text color="fgMuted">胜率 68%</Text>
                </HStack>
                <Text color="fgMuted">加入于 2024-01</Text>
              </VStack>
            </HStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <VStack align="start" spacing={4}>
              <Text fontWeight="bold">资产概览</Text>
              <HStack justify="space-between" w="full">
                <Text color="fgMuted">总资产</Text>
                <Text fontWeight="bold">$12,340.50</Text>
              </HStack>
              <HStack justify="space-between" w="full">
                <Text color="fgMuted">本月收益</Text>
                <Text color="success">+$1,240.00 (+11.2%)</Text>
              </HStack>
              <Button size="sm" colorScheme="brand">充值</Button>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  )
}