import { Box, Flex, HStack, IconButton, Input, Avatar, Badge, Text, Button } from '@chakra-ui/react'
import { SearchIcon, BellIcon } from '@chakra-ui/icons'
import { NavLink } from 'react-router-dom'

export default function NavBar(){
  return (
    <Box
      as="header"
      w="100%"
      bg="bg"
      borderBottom="2px solid"
      borderColor="border"
      _dark={{ backdropFilter: 'blur(20px)', borderColor: 'border' }}
      px={{ base:6, md:8 }}
      h="56px"
      position="sticky"
      top={0}
      zIndex={20}
    >
      <Flex align="center" justify="space-between" maxW="1440px" mx="auto" h="full">
        <HStack spacing={3}>
          <Box w={6} h={6} bg="brand.500" borderRadius="10px" />
          <Text fontSize="16px" fontWeight={700} letterSpacing="-0.5px">ATrade</Text>
        </HStack>

        <HStack spacing={6} display={{ base:'none', md:'flex' }}>
          <NavLinkItem to="/trade">Trade</NavLinkItem>
          <NavLinkItem to="/strategy">Strategy</NavLinkItem>
          <NavLinkItem to="/community">Community</NavLinkItem>
          <NavLinkItem to="/profile">Profile</NavLinkItem>
        </HStack>

        <HStack spacing={3}>
          <Input
            placeholder="搜索币种或策略"
            size="sm"
            w={{ base:'140px', md:'260px' }}
            borderRadius="12px"
            bg="cardBg"
            border="1px solid"
            borderColor="border"
            _placeholder={{ color:'fgMuted' }}
          />
          <IconButton aria-label="通知" icon={<BellIcon />} variant="ghost" borderRadius="12px" />
          <Avatar size="sm" name="U" />
        </HStack>
      </Flex>
    </Box>
  )
}

function NavLinkItem({ to, children }: { to: string; children: React.ReactNode }){
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <Box
          px={4}
          py={2}
          borderRadius="12px"
          bg={isActive ? 'brand.600' : 'transparent'}
          color={isActive ? 'fg' : 'fgMuted'}
          fontWeight={isActive ? 600 : 500}
          _hover={{ bg: isActive ? 'brand.700' : 'hoverBg' }}
          transition="all .2s"
        >
          {children}
        </Box>
      )}
    </NavLink>
  )
}