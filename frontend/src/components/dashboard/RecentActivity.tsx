import {
  Box,
  HStack,
  Heading,
  Icon,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import type { RecentActivityEvent, RecentActivityType } from '../../types';

interface RecentActivityProps {
  events: RecentActivityEvent[];
  limit?: number;
}

interface IconConfig {
  path: string;
  color: string;
  routePrefix: '/medications' | '/interactions' | null;
}

const TYPE_CONFIG: Record<RecentActivityType, IconConfig> = {
  med_added: {
    path: 'M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1z',
    color: 'green.500',
    routePrefix: '/medications',
  },
  analysis_run: {
    path: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-10v2h14V7H7z',
    color: 'purple.500',
    routePrefix: '/interactions',
  },
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function RecentActivity({
  events,
  limit = 5,
}: RecentActivityProps): JSX.Element {
  const navigate = useNavigate();
  const subtle = useColorModeValue('gray.500', 'gray.400');
  const dividerColor = useColorModeValue('gray.100', 'gray.700');

  const visible = events.slice(0, limit);

  const handleClick = (event: RecentActivityEvent): void => {
    const cfg = TYPE_CONFIG[event.type];
    if (cfg.routePrefix && event.ref_id !== null) {
      navigate(`${cfg.routePrefix}/${event.ref_id}`);
    }
  };

  return (
    <GlassCard hoverable={false}>
      <VStack align="stretch" spacing={4}>
        <Heading as="h2" size="md">
          Recent activity
        </Heading>
        {visible.length === 0 ? (
          <Text color={subtle} fontSize="sm">
            No activity yet. Add a medication or run an analysis to get started.
          </Text>
        ) : (
          <VStack align="stretch" spacing={0} divider={<Box h="1px" bg={dividerColor} />}>
            {visible.map((event, i) => {
              const cfg = TYPE_CONFIG[event.type];
              const clickable =
                cfg.routePrefix !== null && event.ref_id !== null;
              return (
                <HStack
                  key={`${event.type}-${event.occurred_at}-${i}`}
                  py={3}
                  spacing={3}
                  align="center"
                  cursor={clickable ? 'pointer' : 'default'}
                  onClick={clickable ? () => handleClick(event) : undefined}
                  role={clickable ? 'button' : undefined}
                  _hover={clickable ? { transform: 'translateX(2px)' } : undefined}
                  transition="transform 0.15s ease"
                >
                  <Icon
                    viewBox="0 0 24 24"
                    boxSize={5}
                    color={cfg.color}
                    aria-hidden
                    flexShrink={0}
                  >
                    <path fill="currentColor" d={cfg.path} />
                  </Icon>
                  <Text flex="1" fontSize="sm" noOfLines={1}>
                    {event.label}
                  </Text>
                  <Text fontSize="xs" color={subtle} flexShrink={0}>
                    {formatRelative(event.occurred_at)}
                  </Text>
                </HStack>
              );
            })}
          </VStack>
        )}
      </VStack>
    </GlassCard>
  );
}
