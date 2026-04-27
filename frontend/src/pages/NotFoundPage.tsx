import { VStack, Heading, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GradientButton } from '../components/ui/GradientButton';

export function NotFoundPage(): JSX.Element {
  return (
    <PageWrapper>
      <VStack spacing={6} py={20} textAlign="center">
        <Heading
          as="h1"
          size="3xl"
          bgGradient="linear(to-r, brand.500, pink.500)"
          bgClip="text"
        >
          404
        </Heading>
        <Heading as="h2" size="lg">
          Page not found
        </Heading>
        <Text color="gray.600" maxW="md">
          The page you are looking for does not exist or was moved.
        </Text>
        <GradientButton as={RouterLink} to="/">
          Back to home
        </GradientButton>
      </VStack>
    </PageWrapper>
  );
}
