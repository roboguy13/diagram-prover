import { EditorMsg } from './components/Editor/EditorMsg';
import { editorUpdate } from './components/Editor/EditorUpdate';
import { Model } from './Model';

export type Msg =
  | { kind: 'EditorMsg', msg: EditorMsg }

export function update(model: Model, msg: Msg): Model {
  switch (msg.kind) {
    case 'EditorMsg':
      return editorUpdate(model, msg.msg);
  }
}
