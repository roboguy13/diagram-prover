import { BaseEdge, EdgeProps, getBezierPath, Position } from '@xyflow/react';
import React from 'react';

// TODO: Find a better way
const HANDLE_SIZE = 0 //9

export function InvertedBezierEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  markerStart,
}: EdgeProps) {
  const startY = sourceY + HANDLE_SIZE; 

  // Calculate control points for an "up from source, down to target" Bezier curve
  const dy = Math.abs(startY - targetY);
  // Adjust the multiplier (0.25) as needed for the desired curve intensity
  const controlPointOffset = dy * 0.25;

  // Control point ABOVE source handle
  const sourceControlY = startY - controlPointOffset;
  // Control point BELOW target handle
  const targetControlY = targetY + controlPointOffset;

  // Construct the SVG path string
  const path = `M ${sourceX},${startY} C ${sourceX},${sourceControlY} ${targetX},${targetControlY} ${targetX},${targetY}`;

  return (
    <BaseEdge
      path={path}
      markerEnd={markerEnd}
      markerStart={markerStart}
      style={{ ...style, stroke: 'cornflowerblue' }}
    />
  );
}