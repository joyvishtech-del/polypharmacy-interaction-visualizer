import {
  Box,
  Flex,
  HStack,
  Heading,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Avatar,
  useColorModeValue,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function Header(): JSX.Element {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('white', 'gray.900');

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/');
  };

  return (
    <Box
      as="header"
      bg={bg}
      borderBottom="1px solid"
      borderColor={borderColor}
      position="sticky"
      top={0}
      zIndex={10}
      backdropFilter="saturate(180%) blur(8px)"
    >
      <Flex
        maxW="1200px"
        mx="auto"
        px={{ base: 4, md: 8 }}
        py={3}
        align="center"
        justify="space-between"
      >
        <Heading
          as={RouterLink}
          to="/"
          size="md"
          bgGradient="linear(to-r, brand.500, pink.500)"
          bgClip="text"
          fontWeight="bold"
        >
          Polypharmacy Visualizer
        </Heading>

        <HStack spacing={3}>
          {isAuthenticated && user ? (
            <Menu>
              <MenuButton
                as={Button}
                variant="ghost"
                rounded="full"
                px={2}
                py={1}
                aria-label="Account menu"
              >
                <HStack>
                  <Avatar size="sm" name={user.full_name ?? user.email} />
                  <Box
                    display={{ base: 'none', md: 'block' }}
                    fontSize="sm"
                    fontWeight="medium"
                    maxW="160px"
                    isTruncated
                  >
                    {user.full_name ?? user.email}
                  </Box>
                </HStack>
              </MenuButton>
              <MenuList>
                <MenuItem as={RouterLink} to="/dashboard">
                  Dashboard
                </MenuItem>
                <MenuItem as={RouterLink} to="/profile">
                  Profile
                </MenuItem>
                <MenuItem as={RouterLink} to="/settings">
                  Settings
                </MenuItem>
                <MenuItem onClick={() => void handleLogout()}>Log out</MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <>
              <Button as={RouterLink} to="/login" variant="ghost" size="sm">
                Login
              </Button>
              <Button
                as={RouterLink}
                to="/register"
                colorScheme="purple"
                size="sm"
              >
                Register
              </Button>
            </>
          )}
        </HStack>
      </Flex>
    </Box>
  );
}
