import { Edge, Node } from "@xyflow/react";

export interface EdgeRouter {
  route(nodes: Node[], edges: Edge[]): Promise<Edge[]>;
}
