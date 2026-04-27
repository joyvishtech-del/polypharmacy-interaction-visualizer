import { Button, type ButtonProps } from '@chakra-ui/react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

const MotionButton = motion(Button);

type MotionButtonProps = Omit<ButtonProps, keyof HTMLMotionProps<'button'>> &
  HTMLMotionProps<'button'> & {
    /**
     * Forwarded when the button is rendered as a react-router `Link`
     * (i.e. ``<GradientButton as={RouterLink} to="/path" />``). Chakra strips
     * polymorphic-as extras from button typing, so we declare it explicitly.
     */
    to?: string;
  };

export const GradientButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  (props, ref) => {
    return (
      <MotionButton
        ref={ref}
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15 }}
        bgGradient="linear(to-r, brand.500, pink.500)"
        color="white"
        fontWeight="semibold"
        rounded="full"
        px={8}
        py={6}
        _hover={{
          bgGradient: 'linear(to-r, brand.600, pink.600)',
          boxShadow: 'lg',
        }}
        _active={{ bgGradient: 'linear(to-r, brand.700, pink.700)' }}
        {...props}
      />
    );
  }
);

GradientButton.displayName = 'GradientButton';
