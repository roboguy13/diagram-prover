import { Term } from "./Term";

export function prettyPrintTerm(t: Term): string {
  switch (t.type) {
    case 'Var':
      return t.name.name ?? ('?' + t.name.ix);
    case 'UnitTy':
      return 'UnitTy';
    case 'Empty':
      return 'Empty';
    case 'Type':
      return 'Type';
    case 'Pi': {
      let paramName = t.paramName ? t.paramName : '?'

      if (binderUsed(0, t.body)) {
        return `((${paramName} : ${prettyPrintTerm(t.paramTy)}) → ${prettyPrintTerm(t.body)})`;
      } else {
        return `(${ppParens(t.paramTy)} → ${prettyPrintTerm(t.body)})`;
      }
    }
    case 'Lam': {
      let paramName = t.paramName ? t.paramName : '?'
      return `λ(${paramName} : ${prettyPrintTerm(t.paramTy)}). ${prettyPrintTerm(t.body)}`;
    }
    case 'App':
      return prettyPrintApps(t.func, t.arg);
    case 'unit':
      return '()';
    case 'Ann':
      return `${prettyPrintTerm(t.term)} : ${prettyPrintTerm(t.ty)}`;
  }
}

function prettyPrintApps(func: Term, arg: Term): string {
  if (func.type === 'App') {
    return prettyPrintApps(func.func, func.arg) + ' ' + ppParens(arg);
  } else {
    return ppParens(func) + ' ' + ppParens(arg);
  }
}

function ppParens(t: Term): string {
  if (needsParens(t)) {
    return `(${prettyPrintTerm(t)})`;
  }
  return prettyPrintTerm(t);
}

function needsParens(t: Term): boolean {
  switch (t.type) {
    case 'Var':
      return false;
    case 'UnitTy':
      return false;
    case 'Empty':
      return false;
    case 'Type':
      return false;
    case 'Pi':
      return true;
    case 'Lam':
      return true;
    case 'App':
      return true;
    case 'unit':
      return false;
    case 'Ann':
      return true;
  }
}

function binderUsed(ix: number, t: Term): boolean {
  switch (t.type) {
    case 'Var':
      return t.name.ix === ix;
    case 'UnitTy':
      return false;
    case 'Empty':
      return false;
    case 'Type':
      return false;
    case 'Pi':
      return binderUsed(ix, t.paramTy) || binderUsed(ix + 1, t.body);
    case 'Lam':
      return binderUsed(ix, t.paramTy) || binderUsed(ix + 1, t.body);
    case 'App':
      return binderUsed(ix, t.func) || binderUsed(ix, t.arg);
    case 'unit':
      return false;
    case 'Ann':
      return binderUsed(ix, t.term) || binderUsed(ix, t.ty);
  }
}

