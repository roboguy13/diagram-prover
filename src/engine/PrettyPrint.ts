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
      return `((${paramName} : ${prettyPrintTerm(t.paramTy)}) -> ${prettyPrintTerm(t.body)})`;
    }
    case 'Lam': {
      let paramName = t.paramName ? t.paramName : '?'
      return `\\(${paramName} : ${prettyPrintTerm(t.paramTy)}). ${prettyPrintTerm(t.body)}`;
    }
    case 'App':
      return prettyPrintApps(t.func, t.arg);
    case 'unit':
      return '()';
    case 'Ann':
      return `(${prettyPrintTerm(t.term)} : ${prettyPrintTerm(t.ty)})`;
  }
}

function prettyPrintApps(func: Term, arg: Term): string {
  if (func.type === 'App') {
    return prettyPrintApps(func.func, func.arg) + ' ' + prettyPrintTerm(arg);
  } else {
    return prettyPrintTerm(func) + ' ' + prettyPrintTerm(arg);
  }
}
