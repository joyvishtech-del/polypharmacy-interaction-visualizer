import { Box, Flex } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Header } from './Header';
import { Disclaimer } from '../ui/Disclaimer';

interface PageWrapperProps {
  children: ReactNode;
  hideDisclaimer?: boolean;
}

export function PageWrapper({ children, hideDisclaimer = false }: PageWrapperProps): JSX.Element {
  return (
    <Flex direction="column" minH="100vh" bg="gray.50">
      <Header />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ flex: 1, width: '100%' }}
      >
        <Box maxW="1200px" mx="auto" px={{ base: 4, md: 8 }} py={8} w="100%">
          {children}
        </Box>
      </motion.main>
      {!hideDisclaimer && <Disclaimer />}
    </Flex>
  );
}
