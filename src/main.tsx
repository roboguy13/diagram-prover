import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';

import './index.css';

import { enableMapSet } from 'immer';
import { toFlow } from './ui/render/layout/LayoutEngine';
import { prettyPrintTerm } from './engine/PrettyPrint';
import { exampleTerm } from './engine/Term';
import { inferType } from './engine/TypeCheck';
import { ReactFlowProvider } from '@xyflow/react';

enableMapSet(); // Initialize immer so it can use Map and Set

console.log('Term: ', prettyPrintTerm(exampleTerm));
console.log('Type infer: ', inferType([], new Map([]), exampleTerm));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </React.StrictMode>
);
