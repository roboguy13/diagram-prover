import { EditorMsg } from '../components/Editor/EditorMsg';
import { editorUpdate } from '../components/Editor/EditorUpdate';
import { Cmd } from './Cmd';
import { Model } from './Model';

export type Msg =
  | { kind: 'EditorMsg', msg: EditorMsg }

export type Dispatch = (msg: Msg) => void;

export function update(model: Model, msg: Msg): [Model, Cmd | null] {
  switch (msg.kind) {
    case 'EditorMsg':
      return editorUpdate(model, msg.msg);
  }
}
