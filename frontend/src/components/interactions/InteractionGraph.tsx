import { useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, HStack, Stack, Text, VStack, useColorModeValue } from '@chakra-ui/react';
import type { InteractionEdge, Medication, Severity } from '../../types';
import { SeverityLegend } from './SeverityLegend';

interface InteractionGraphProps {
  medications: Medication[];
  edges: InteractionEdge[];
  height?: number | string;
}

const SEVERITY_COLOR: Record<Severity, string> = {
  red: '#E53E3E',
  yellow: '#D69E2E',
  green: '#38A169',
};

interface EdgeTooltipData extends Record<string, unknown> {
  drugA: string;
  drugB: string;
  explanation: string;
  severity: Severity;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  red: 'Severe',
  yellow: 'Moderate',
  green: 'Low',
};

function buildCircleNodes(
  medications: Medication[],
  nodeBg: string,
  nodeColor: string,
  nodeBorder: string
): Node[] {
  const count = medications.length;
  const radius = Math.max(160, count * 40);
  const centerX = 0;
  const centerY = 0;

  return medications.map((med, index) => {
    const angle = (2 * Math.PI * index) / Math.max(count, 1);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return {
      id: String(med.id),
      position: { x, y },
      data: { label: `${med.name}\n${med.dosage}` },
      style: {
        background: nodeBg,
        color: nodeColor,
        border: `1px solid ${nodeBorder}`,
        borderRadius: 12,
        padding: 10,
        fontSize: 12,
        whiteSpace: 'pre-line',
        textAlign: 'center',
        minWidth: 120,
      },
    };
  });
}

function buildEdges(
  medications: Medication[],
  interactions: InteractionEdge[]
): Edge<EdgeTooltipData>[] {
  const byName = new Map<string, string>();
  for (const med of medications) {
    byName.set(med.name.toLowerCase(), String(med.id));
  }

  return interactions
    .map((edge): Edge<EdgeTooltipData> | null => {
      const sourceId = byName.get(edge.drug_a.toLowerCase());
      const targetId = byName.get(edge.drug_b.toLowerCase());
      if (!sourceId || !targetId) {
        return null;
      }
      const stroke = SEVERITY_COLOR[edge.severity];
      return {
        id: `e-${edge.id}`,
        source: sourceId,
        target: targetId,
        animated: edge.severity === 'red',
        style: {
          stroke,
          strokeWidth: edge.severity === 'red' ? 3 : 2,
          cursor: 'help',
        },
        data: {
          drugA: edge.drug_a,
          drugB: edge.drug_b,
          explanation: edge.explanation,
          severity: edge.severity,
        },
        label: edge.severity.toUpperCase(),
        labelStyle: { fill: stroke, fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.85 },
      };
    })
    .filter((e): e is Edge<EdgeTooltipData> => e !== null);
}

function InteractionGraphInner({
  medications,
  edges,
  height = 480,
}: InteractionGraphProps): JSX.Element {
  const nodeBg = useColorModeValue('#ffffff', '#1a202c');
  const nodeColor = useColorModeValue('#1a202c', '#f7fafc');
  const nodeBorder = useColorModeValue('#cbd5e0', '#4a5568');
  const panelBg = useColorModeValue('whiteAlpha.900', 'gray.700');
  const panelBorder = useColorModeValue('gray.200', 'gray.600');
  const subtle = useColorModeValue('gray.600', 'gray.300');

  const [activeEdge, setActiveEdge] = useState<EdgeTooltipData | null>(null);
  const [pinned, setPinned] = useState<boolean>(false);

  const nodes = useMemo(
    () => buildCircleNodes(medications, nodeBg, nodeColor, nodeBorder),
    [medications, nodeBg, nodeColor, nodeBorder]
  );
  const flowEdges = useMemo(
    () => buildEdges(medications, edges),
    [medications, edges]
  );

  const onEdgeMouseEnter = (_: React.MouseEvent, edge: Edge): void => {
    if (pinned) return;
    setActiveEdge((edge.data ?? null) as EdgeTooltipData | null);
  };
  const onEdgeMouseLeave = (): void => {
    if (pinned) return;
    setActiveEdge(null);
  };
  const onEdgeClick = (_: React.MouseEvent, edge: Edge): void => {
    const data = (edge.data ?? null) as EdgeTooltipData | null;
    if (!data) return;
    if (pinned && activeEdge?.drugA === data.drugA && activeEdge?.drugB === data.drugB) {
      setPinned(false);
      setActiveEdge(null);
    } else {
      setActiveEdge(data);
      setPinned(true);
    }
  };

  return (
    <Stack
      direction={{ base: 'column', md: 'row' }}
      align="stretch"
      spacing={4}
      w="100%"
    >
      <Box
        position="relative"
        flex="1"
        minW={0}
        height={height}
        borderRadius="2xl"
        overflow="hidden"
        border="1px solid"
        borderColor={nodeBorder}
      >
        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => {
            setPinned(false);
            setActiveEdge(null);
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* Floating tooltip panel for the hovered or pinned edge */}
        {activeEdge && (
          <Box
            position="absolute"
            bottom={3}
            left={3}
            right={3}
            maxW="md"
            mx="auto"
            bg={panelBg}
            border="1px solid"
            borderColor={panelBorder}
            borderRadius="lg"
            p={3}
            backdropFilter="blur(8px)"
            boxShadow="lg"
            zIndex={5}
            pointerEvents="none"
          >
            <VStack align="stretch" spacing={1}>
              <HStack justify="space-between">
                <Text fontWeight="bold" fontSize="sm">
                  {activeEdge.drugA} ↔ {activeEdge.drugB}
                </Text>
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  color={SEVERITY_COLOR[activeEdge.severity]}
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  {SEVERITY_LABEL[activeEdge.severity]}
                </Text>
              </HStack>
              <Text fontSize="sm" color={subtle}>
                {activeEdge.explanation}
              </Text>
              {pinned && (
                <Text fontSize="xs" color={subtle} fontStyle="italic">
                  Pinned — click again or click empty space to dismiss.
                </Text>
              )}
            </VStack>
          </Box>
        )}

        {/* Hint for first-time users */}
        {!activeEdge && flowEdges.length > 0 && (
          <Box
            position="absolute"
            top={2}
            right={2}
            bg={panelBg}
            borderRadius="md"
            px={3}
            py={1}
            fontSize="xs"
            color={subtle}
            border="1px solid"
            borderColor={panelBorder}
            zIndex={5}
          >
            Hover or click an edge for details
          </Box>
        )}
      </Box>

      <Box w={{ base: '100%', md: '240px' }} flexShrink={0}>
        <SeverityLegend />
      </Box>
    </Stack>
  );
}

export function InteractionGraph(props: InteractionGraphProps): JSX.Element {
  return (
    <ReactFlowProvider>
      <InteractionGraphInner {...props} />
    </ReactFlowProvider>
  );
}
