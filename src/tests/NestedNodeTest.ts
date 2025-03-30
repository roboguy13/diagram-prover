import { SemanticNode } from "../ir/SemanticGraph";
import { updateGraphLayout } from "../ui/render/layout/UpdateGraphLayout";
import { Model } from "../ui/architecture/Model";

// Create a test function to generate a semantic graph with nested nodes
function createNestedNodeGraph(): SemanticNode<void> {
  // Create a parent node
  const parentNode: SemanticNode<void> = {
    id: 'parent-1',
    label: 'Parent',
    kind: 'Transpose',  // Use Transpose kind to trigger grouped node rendering
    children: [],
    payload: undefined,
    // The key part - define a subgraph of inner nodes
    subgraph: [
      {
        id: 'child-1',
        label: 'Child 1',
        kind: 'Var',
        children: [],
        payload: undefined
      },
      {
        id: 'child-2',
        label: 'Child 2',
        kind: 'Var',
        children: [],
        payload: undefined
      }
    ]
  };

  return parentNode;
}

// // Function to test the nested node layout
// export async function testNestedNodeLayout(model: Model) {
//   const graph = createNestedNodeGraph();
  
//   // Use your existing layout system to process the graph
//   const result = await updateGraphLayout(model, {
//     type: 'Var', // Dummy term type to satisfy TypeScript
//     id: 'test',
//     name: { type: 'VarId', ix: 0 },
//     // Override the term-to-semantic conversion by adding a _semanticNode field
//     _semanticNode: graph
//   });
  
//   console.log('Nested node layout result:', result);
//   return result;
// }
