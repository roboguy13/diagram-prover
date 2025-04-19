import { Term, VarTerm, LamTerm, AppTerm, Type, Context as TermContext } from "../engine/Term"; // Renamed Context to TermContext
import { Diagram, DiagramBuilder, OpenDiagram, OpenDiagramBuilder, PortRef } from "./StringDiagram";

export function termToStringDiagram(term: Term): OpenDiagram {
  const builder = new TermDiagramBuilder();
  builder.build(term, []);
  return builder.finish()
}

class TermDiagramBuilder {
  private _builder: OpenDiagramBuilder;

  constructor(builder: OpenDiagramBuilder = new OpenDiagramBuilder()) {
    this._builder = builder;
  }

  public build(term: Term, env: PortRef[]): PortRef {
    switch (term.type) {
      case 'Var':
        return this.buildVar(term, env);
      case 'Lam':
        return this.buildLam(term.body);
      case 'App':
        const func = this.build(term.func, env);
        const arg = this.build(term.arg, env);
        return this.buildApp(func, arg);
      case 'unit':
        return this.buildUnit();
      default:
        throw new Error(`Unhandled term type: ${term.type}`);
    }
  }

  private buildVar(term: VarTerm, env: PortRef[]): PortRef {
    if (term.kind === 'BoundVar') {
      const ref = env[term.index]
      if (!ref) {
        throw new Error(`No variable found at index ${term.index}`);
      }

      return ref
    }

    return this._builder.freeVar(term.name);
  }

  private buildUnit(): PortRef {
    return this._builder.unit();
  }

  private buildLam(term: Term): PortRef {
    const { paramCount, body } = TermDiagramBuilder.collectLamParameters(term);

    return this._builder.lam(paramCount, (builder: DiagramBuilder, params: PortRef[]): PortRef => {
      const newBuilder = new TermDiagramBuilder(new OpenDiagramBuilder(builder, this._builder.freeVars, this._builder.portBarId));
      return newBuilder.build(body, params);
    })
  }

  private buildApp(f: PortRef, arg: PortRef): PortRef {
    return this._builder.app(f, arg);
  }

  finish(): OpenDiagram {
    return this._builder.finish();
  }

  private static collectLamParameters(term: Term): { paramCount: number; body: Term } {
    if (term.type === 'Lam') {
      const { paramCount, body } = TermDiagramBuilder.collectLamParameters(term.body);
      return { paramCount: paramCount + 1, body };
    } else {
      return { paramCount: 0, body: term };
    }
  }
}
