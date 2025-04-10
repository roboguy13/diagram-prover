// Based on https://math.andrej.com/2012/11/08/how-to-implement-dependent-type-theory-i/

import { Type, Term, TermId, Context } from './Term' 
import { normalize, equalTerms } from './Normalize';
import { prettyPrintTerm } from './PrettyPrint';
import { subst1 } from './Subst';

import { produce } from 'immer';

export type TypeError = { msg: string, term: Term }

type FreeVarContext = ReadonlyMap<string, Type> // TODO: Should this be combined into Context?

type CheckResult<A> =
  | { type: 'correct', result: A }
  | { type: 'error', err: TypeError}

// TODO: Update implementation
export function inferType(ctx: Context, freeVarContext: FreeVarContext, term: Term): CheckResult<Type> {
  return { type: 'correct', result: term }
  // switch (term.type) {
  //   case 'Var':
  //     let varTy = ctx[term.index];
  //     if (varTy === undefined) {
  //       return { type: 'error', err: { msg: 'Variable is not in context', term: term } }
  //     } else {
  //       return { type: 'correct', result: varTy }
  //     }

  //   case 'UnitTy':
  //     return { type: 'correct', result: { type: 'Type', universe: 1 } }

  //   case 'Empty':
  //     return { type: 'correct', result: { type: 'Type', universe: 1 } }

  //   case 'Type':
  //     return { type: 'correct', result: { type: 'Type', universe: term.universe + 1 } }

  //   case 'unit':
  //     return { type: 'correct', result: { type: 'UnitTy' } }

  //   case 'Pi':
  //     let k1 = inferUniverse(ctx, term.paramTy);

  //     let newCtx: Context = produce<Context>(ctx, (draft: Context) => {
  //       draft.unshift(term.paramTy);
  //     });

  //     let k2 = inferUniverse(newCtx, term.body);

  //     if (k1.type === 'error') {
  //       return k1;
  //     } if (k2.type === 'error') {
  //       return k2;
  //     } else {
  //       return { type: 'correct', result: { type: 'Type', universe: Math.max(k1.result, k2.result) } }
  //     }

  //   case 'Lam':
  //     let k = inferUniverse(ctx, term.paramTy);
  //     if (k.type === 'error') {
  //       return k;
  //     } else {
  //       const newCtx: Context = produce<Context>(ctx, (draft: Context) => {
  //         draft.unshift(term.paramTy);
  //       });
  //       let bodyTy = inferType(newCtx, term.body);
  //       if (bodyTy.type === 'error') {
  //         return bodyTy;
  //       } else {
  //         return { type: 'correct', result: { type: 'Pi', paramTy: term.paramTy, body: bodyTy.result } }
  //       }
  //     }

  //   case 'App':
  //     let e1 = term.func;
  //     let e2 = term.arg;

  //     let pi = inferPi(ctx, e1);

  //     if (pi.type === 'error') {
  //       return pi;
  //     } else {
  //       let s = pi.result.paramTy;
  //       let t = pi.result.body;

  //       let te = inferType(ctx, e2);

  //       if (te.type === 'error') {
  //         return te;
  //       } else if (!equalTerms(s, te.result)) {
  //         return { type: 'error', err: { msg: `Expected ${prettyPrintTerm(s)} but got ${prettyPrintTerm(te.result)}`, term: e2 } }
  //       } else {
  //         return { type: 'correct', result: subst1(t, e2) }
  //       }
  //     }

  //   case 'Ann':
  //     return checkType(ctx, term.term, term.ty);
  // }
}

// TODO: Update implementation
export function checkType(ctx: Context, term: Term, ty: Type): CheckResult<Type> {
  return { type: 'correct', result: ty }
  // let t = inferType(ctx, term);
  // if (t.type === 'error') {
  //   return t;
  // } else {
  //   let normalized = normalize(t.result);
  //   let normalizedTy = normalize(ty);

  //   if (!equalTerms(normalized, normalizedTy)) {
  //     return { type: 'error', err: { msg: `Expected ${prettyPrintTerm(normalizedTy)} but got ${prettyPrintTerm(normalized)}`, term: term } }
  //   } else {
  //     return { type: 'correct', result: ty }
  //   }
  // }
}

// function inferPi(ctx: Context, term: Term): CheckResult<{ type: 'Pi', paramTy: Type, body: Term }> {
//   let t = inferType(ctx, term);
//   if (t.type === 'error') {
//     return t;
//   } else {
//     let ty = normalize(t.result);
//     switch (ty.type) {
//       case 'Pi':
//         return { type: 'correct', result: ty }
//       default:
//         return { type: 'error', err: { msg: `Expected function but got ${prettyPrintTerm(ty)}`, term: term } }
//     }
//   }
// }

// function inferUniverse(ctx: Context, term: Term): CheckResult<number> {
//   let ty = inferType(ctx, term);

//   if (ty.type === 'correct') {
//     let normalized = normalize(ty.result);
//     switch (normalized.type) {
//       case 'Type':
//         return { type: 'correct', result: normalized.universe }
//       default:
//         return { type: 'error', err: { msg: `Type expected but got ${prettyPrintTerm(normalized)} when inferring universe`, term: term } }
//     }
//   } else {
//     return { type: 'error', err: ty.err };
//   }
// }
