import { BaseEdge, EdgeProps, getBezierPath, Position } from '@xyflow/react';
import React from 'react';

// TODO: Find a better way to handle this offset

// Define an offset distance - how far "inward" from the handle the edge should start/end
// Adjust this value to control the visual effect
const ATTACHMENT_OFFSET = 7; // pixels

type WhichInvert = 'source' | 'target' | 'both';

export function BothInvertedBezierEdge(props: EdgeProps) {
  return InvertedBezierEdge('both', props);
}

export function SourceInvertedBezierEdge(props: EdgeProps) {
  return InvertedBezierEdge('source', props);
}

export function TargetInvertedBezierEdge(props: EdgeProps) {
  return InvertedBezierEdge('target', props);
}

function InvertedBezierEdge(whichInvert: WhichInvert, {
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition, // The actual position of the source handle
  targetPosition, // The actual position of the target handle
  style = {},
  markerEnd,
  markerStart,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
}: EdgeProps) {

  // --- 1. Calculate Adjusted Coordinates ---
  let adjustedSourceX = sourceX;
  let adjustedSourceY = sourceY;
  let adjustedTargetX = targetX;
  let adjustedTargetY = targetY;

  // Offset the source coordinates based on the *original* handle position
  if (whichInvert === 'source' || whichInvert === 'both') {
    switch (sourcePosition) {
      case Position.Top:
        adjustedSourceY += ATTACHMENT_OFFSET;
        break;
      case Position.Bottom:
        adjustedSourceY -= ATTACHMENT_OFFSET;
        break;
      case Position.Left:
        adjustedSourceX += ATTACHMENT_OFFSET;
        break;
      case Position.Right:
        adjustedSourceX -= ATTACHMENT_OFFSET;
        break;
    }
  }

  // Offset the target coordinates based on the *original* handle position
  if (whichInvert === 'target' || whichInvert === 'both') {
    switch (targetPosition) {
      case Position.Top:
        adjustedTargetY += ATTACHMENT_OFFSET;
        break;
      case Position.Bottom:
        adjustedTargetY -= ATTACHMENT_OFFSET;
        break;
      case Position.Left:
        adjustedTargetX += ATTACHMENT_OFFSET;
        break;
      case Position.Right:
        adjustedTargetX -= ATTACHMENT_OFFSET;
        break;
    }
  }

  // --- 2. Calculate Opposite Positions (for curve direction) ---
  const oppositeSourcePosition = (whichInvert === 'source' || whichInvert === 'both') ? getOppositePosition(sourcePosition) : sourcePosition;
  const oppositeTargetPosition = (whichInvert === 'target' || whichInvert === 'both') ? getOppositePosition(targetPosition) : targetPosition;

  // --- 3. Generate Path ---
  // Use ADJUSTED coordinates and OPPOSITE positions
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition: oppositeSourcePosition,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    targetPosition: oppositeTargetPosition,
  });

  // Create a props object with only defined properties
  const edgeProps = {
    id,
    path: edgePath,
    labelX,
    labelY,
    ...(markerEnd !== undefined && { markerEnd }),
    ...(markerStart !== undefined && { markerStart }),
    style,
    ...(label !== undefined && { label }),
    ...(labelStyle !== undefined && { labelStyle }),
    ...(labelShowBg !== undefined && { labelShowBg }),
    ...(labelBgStyle !== undefined && { labelBgStyle }),
    ...(labelBgPadding !== undefined && { labelBgPadding }),
    ...(labelBgBorderRadius !== undefined && { labelBgBorderRadius }),
    ...(interactionWidth !== undefined && { interactionWidth }),
  };

  return <BaseEdge {...edgeProps} />;
}

function getOppositePosition(position: Position): Position {
  switch (position) {
    case Position.Top:
      return Position.Bottom;
    case Position.Bottom:
      return Position.Top;
    case Position.Left:
      return Position.Right;
    case Position.Right:
      return Position.Left;
    default: // Should not happen with standard positions
      return position;
  }
}
