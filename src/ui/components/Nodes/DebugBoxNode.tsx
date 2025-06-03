import { NodeProps } from "@xyflow/react";
import { DebugBox } from "./nodeTypes";

export function DebugBoxNode({ data }: NodeProps<DebugBox>) {
  return (
    <div
      className={`debug-box-node`}
      style={{ width: data.width, height: data.height, zIndex: 1000 }}
    >
      {data.label}
    </div>
  );
}