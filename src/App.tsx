import { useRef, useEffect, useCallback, useReducer } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  type OnConnect,
  useReactFlow,
  Panel,
  ConnectionMode,
  useNodesInitialized,
} from '@xyflow/react';

import { ChevronRightIcon, MagicWandIcon } from '@radix-ui/react-icons'

import '@xyflow/react/dist/style.css';

import { nodeTypes } from './ui/components/Nodes';
import { edgeTypes } from './edges';
import { ApplicationNode } from './ui/components/Nodes/nodeTypes';
import { update } from './ui/architecture/Msg';
import { initialModel, Model } from './ui/architecture/Model';

import { topSortNodes } from './ui/render/layout/TopSort';
import { useElmish } from './ui/architecture/Elmish';
import { ConstraintLayoutEngine, NodeListAndEdges, NodesAndEdges } from './ui/render/layout/LayoutEngine';
import { theLayoutEngine } from './ui/render/layout/LayoutEngineConfig';
import { debugConfictHandler } from './ui/render/layout/recursiveBox/DebugConflictHandler';
import { PortBarComponent } from './ui/components/Nodes/PortBar/PortBarComponent';
import { PanelPortBar } from './ui/components/Editor/PanelPortBar/PanelPortBarComponent';
import { RecursiveBoxEngine } from './ui/render/layout/recursiveBox/RecursiveBoxEngine';
import { ElkRouter } from './ui/render/routing/ElkRouter';

export interface Props {
  nodesAndEdges: NodesAndEdges;
}

function isLayoutReady(nodes: ApplicationNode[]): boolean {
  // See if there are dimensions for every node

  for (const node of nodes) {
    if (!node.width || !node.height) {
      return false;
    }
  }
  return true
}

export default function App() {
  // const [state, dispatch] = useReducer(update, initialModel);
  let [state, dispatch] = useElmish(initialModel)

  const reactFlowInstance = useReactFlow();

  // let nodes = topSortNodes(state.graph?.nodes ?? new Map<string, ApplicationNode>())
  let nodes: ApplicationNode[] = state.graph?.nodes ?? [];
  let edges = state.graph?.edges ?? [];

  const inputBarId = state.inputBar?.id;
  const outputBarId = state.outputBar?.id;

  const existingNodeIds = Array.from(state.graph?.nodes.keys() || []);
  const nodesInitialized = useNodesInitialized();

  // if (state.mode === 'normal-mode') {
  //   if (inputBarId && !existingNodeIds.includes(inputBarId)) {
  //     nodes.push(state.inputBar);
  //   }

  //   if (outputBarId && !existingNodeIds.includes(outputBarId)) {
  //     nodes.push(state.outputBar);
  //   }
  // }

  // useEffect(() => {
  //   console.log("--- Routing Effect Check ---");
  //   console.log("Nodes Initialized:", nodesInitialized);
  //   console.log("Nodes in state:", nodes.length);
  //   console.log("Edges in state:", edges.length);

  //   const layoutReady = isLayoutReady(nodes);
  //   console.log("Is Layout Ready:", layoutReady);

  //   if (!layoutReady && nodes.length > 0) {
  //     console.log("Nodes missing dimensions:");
  //     nodes.forEach(n => {
  //       // Only log if dimensions are missing *after* initialization is expected
  //       if (nodesInitialized && (!n.width || !n.height)) {
  //         console.log(`  Node ID: ${n.id}, Width: ${n.width}, Height: ${n.height}`);
  //       } else if (!nodesInitialized) {
  //          console.log(`  Node ID: ${n.id} - Waiting for initialization.`);
  //       }
  //     });
  //   }

  //   // Check all conditions
  //   if (nodesInitialized && nodes.length > 0 && edges.length > 0 && layoutReady) {
  //     console.log("Conditions met, attempting to run router...");
  //     try {
  //       const router = new ElkRouter();
  //       // Pass the nodes from state, which should now have dimensions
  //       const newEdges = router.route(nodes, edges);
  //       console.log("Router finished. New Edges:", newEdges);

  //       // IMPORTANT: Dispatch an action to update state.graph.edges with newEdges.
  //       // Make sure this dispatch doesn't cause an infinite loop.
  //       // Only dispatch if newEdges are different from edges.
  //       // Example:
  //       // if (JSON.stringify(newEdges) !== JSON.stringify(edges)) {
  //       //    console.log("Dispatching updated edges...");
  //       //    dispatch({ kind: 'EditorMsg', msg: { type: 'UpdateEdgesMsg', edges: newEdges } });
  //       // } else {
  //       //    console.log("No edge changes detected, skipping dispatch.");
  //       // }

  //     } catch (error) {
  //         console.error("Error during ElkRouter execution:", error);
  //     }

  //   } else {
  //     console.log("Routing conditions not met.");
  //   }
  //    console.log("--- End Routing Effect Check ---");
  //   // Dependencies now use the state-derived variables
  // }, [nodes, edges, nodesInitialized, dispatch]);

  // useEffect(() => {
  //   if (nodes.length > 0 && edges.length > 0 && isLayoutReady(nodes)) {
  //     const router = new ElkRouter()
  //     const newEdges = router.route(nodes, edges)
  //     console.log('*** new edges:', newEdges)
  //   }
  // }, [nodes, edges, nodesInitialized, dispatch])

  useEffect(() => {
    if (theLayoutEngine instanceof RecursiveBoxEngine) {
      theLayoutEngine.addConflictHandler(net => conflict => {
        if (state.mode !== 'debug-propagators-mode')
          debugConfictHandler(dispatch)(net)(conflict)
      })
    }
  }, [])

  useEffect(() => {
    if (state.updateCenter && reactFlowInstance) {
      // Two key issues with the original code:
      // 1. reactFlowInstance.fitView might not be stable across renders
      // 2. We need to ensure the DOM has fully updated

      // Add a small delay to ensure DOM updates are complete
      const timeoutId = setTimeout(() => {
        // Try-catch to handle potential errors
        try {
          reactFlowInstance.fitView({
            padding: 0.2,
            duration: 300,
            includeHiddenNodes: false
          });
        } catch (error) {
          console.error("Error centering graph:", error);
        }

        // Reset the flag after centering
        dispatch({ kind: 'EditorMsg', msg: { type: 'ResetUpdateCenter' } });
      }, 50);

      // Clean up timeout if component unmounts or effect runs again
      return () => clearTimeout(timeoutId);
    }
    return () => { }
  }, [state.updateCenter]); // Only depend on the updateCenter flag

  // console.log("Rendering React Flow with nodes:", nodes, "and edges:", edges);

  const handleBetaStep = useCallback(() => {
    dispatch({ kind: 'EditorMsg', msg: { type: 'BetaStepMsg' } });
  }, [dispatch]);

  const handleStepBack = useCallback(() => {
    dispatch({ kind: 'EditorMsg', msg: { type: 'StepBackMsg' } });
  }, [dispatch]);

  const handleLayoutDebug = useCallback(() => {
    dispatch({ kind: 'EditorMsg', msg: { type: 'ToggleDebugPropagatorsMode' } });
  }, [dispatch]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if focus is on input elements
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (event.key === 'ArrowRight') {
        handleBetaStep();
      } else if (event.key === 'ArrowLeft') {
        handleStepBack();
      }
    }
    window.addEventListener('keydown', handleKeyDown);

    // Clean up on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  })

  // Fit-to-view
  useEffect(() => {
    const timer = setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({
          padding: 0.2,
          duration: 0,
          includeHiddenNodes: false
        });
      }
    }, 100)
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      // margin: '60px 0',
    }}>
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => dispatch({ kind: 'EditorMsg', msg: { type: 'NodeChangeMsg', changes: changes } })}
        edges={edges}
        edgeTypes={edgeTypes}
        onEdgesChange={(changes) => dispatch({ kind: 'EditorMsg', msg: { type: 'EdgeChangeMsg', changes: changes } })}
        onConnect={(connection) => { }}
        colorMode='dark'
        // connectionMode={ConnectionMode.Loose}
        // elevateEdgesOnSelect={false}
        // elevateNodesOnSelect={false}
        fitView
      >
        <Background />
        <MiniMap position='top-right' />
        {/* These panels will each create their own actual node in the React Flow instance */}
        {/* <Panel position="top-center" style={{ marginTop: '10px' }}>
        <PanelPortBar
          id="top-bar"
          label="Top Port Bar"
          portCount={3}
          isInput={true}
        />
      </Panel>
      
      <Panel position="bottom-center" style={{ marginBottom: '10px' }}>
        <PanelPortBar
          id="bottom-bar"
          label="Bottom Port Bar"
          portCount={2}
          isInput={false}
        />
      </Panel> */}
        {/* <Panel position="top-center" style={{ marginTop: '10px' }}>
          <PanelPortBar
            id="top-bar"
            label="Top Port Bar"
            portCount={3}
            isInput={true}
          />
        </Panel> */}
        <Controls>
          {/* Button for rendering the propagator network as a graph to debug it */}
          <ControlButton onClick={handleLayoutDebug} >
            <MagicWandIcon />
          </ControlButton>

          <ControlButton onClick={handleBetaStep}>
            <ChevronRightIcon />
          </ControlButton>

          <ControlButton onClick={handleStepBack}>
            <ChevronRightIcon style={{ transform: 'rotate(180deg)' }} />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  );
}
