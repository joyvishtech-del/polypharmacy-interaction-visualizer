import { Box, type BoxProps, useColorModeValue } from '@chakra-ui/react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';

const MotionBox = motion(Box);

type MotionBoxProps = Omit<BoxProps, keyof HTMLMotionProps<'div'>> &
  HTMLMotionProps<'div'> & { children?: ReactNode };

interface GlassCardProps extends MotionBoxProps {
  hoverable?: boolean;
  /**
   * Allowed when the card is rendered as a form (``as="form"``). The base
   * MotionBox typing is div-only, so we surface form-specific attributes
   * we actually use rather than widening to ``any``.
   */
  noValidate?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, hoverable = true, ...props }, ref) => {
    const bg = useColorModeValue(
      'rgba(255, 255, 255, 0.65)',
      'rgba(26, 32, 44, 0.55)'
    );
    const borderColor = useColorModeValue(
      'rgba(255, 255, 255, 0.35)',
      'rgba(255, 255, 255, 0.08)'
    );

    return (
      <MotionBox
        ref={ref}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={hoverable ? { y: -4, scale: 1.01 } : undefined}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        bg={bg}
        backdropFilter="blur(14px)"
        borderRadius="2xl"
        border="1px solid"
        borderColor={borderColor}
        boxShadow="0 8px 32px rgba(31, 38, 135, 0.12)"
        p={6}
        {...props}
      >
        {children}
      </MotionBox>
    );
  }
);

GlassCard.displayName = 'GlassCard';
