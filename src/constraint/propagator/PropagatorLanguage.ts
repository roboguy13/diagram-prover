import { alt, apply, buildLexer, expectSingleResult, kmid, Lexer, list_sc, lrec_sc, Parser, rule, seq, str, tok, Token, TokenPosition } from "typescript-parsec"; // Added kmid
import { CellRef, known, PropagatorNetwork } from "./Propagator";
import { add, addList, divNumber, equal, getCellRef, maxList, minList, multNumber, negate, PExpr, sub } from "./PropagatorExpr";
import { addRangePropagator, between, divNumericRangeNumberPropagator, exactly, multNumericRangeNumber, multNumericRangeNumberPropagator, NumericRange, subtractRangePropagator } from "./NumericRange";
import { subtract, toNumber } from "lodash";

enum TokenKind {
  Number,
  Add,
  Sub,
  Equal,
  AddList,
  MaxList,
  MinList,
  MulNum,
  DivNum,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Comma,
  Space,
  VarIdentifier,
}

type PropagatorRelation =
  (net: PropagatorNetwork<NumericRange>) => void;

function concatToken<A>(a: Token<A> | undefined, b: Token<A>): Token<A> {
  if (!a) {
    return b;
  }

  return {
    ... a,
    next: concatToken(a.next, b), 
  }
}

const basicLexer = buildLexer<TokenKind>([
  [false, /^\s+/g, TokenKind.Space],
  [true, /^[0-9]+/g, TokenKind.Number],
  [true, /^\+/g, TokenKind.Add],
  [true, /^=/g, TokenKind.Equal],
  [true, /^\-/g, TokenKind.Sub],
  [true, /^\(/g, TokenKind.LParen],
  [true, /^\)/g, TokenKind.RParen],
  [true, /^max/g, TokenKind.MaxList],
  [true, /^min/g, TokenKind.MinList],
  [true, /^add/g, TokenKind.AddList],
  [true, /^mul/g, TokenKind.MulNum],
  [true, /^div/g, TokenKind.DivNum],
  [true, /^\[/g, TokenKind.LBracket],
  [true, /^\]/g, TokenKind.RBracket],
  [true, /^,/g, TokenKind.Comma],
])

interface VarIdentifierToken extends Token<TokenKind.VarIdentifier> {
  cellRef?: CellRef
}

class Tokenizer {
  private _index: number = 0;
  private _inputCellIndex: number = 0;

  constructor(
    private _inputStrings: string[],
    private _inputCells: CellRef[],
  ) { }

  private buildCellToken(cell: CellRef, index: number): VarIdentifierToken {
    const pos: TokenPosition = { index, rowBegin: 0, columnBegin: 0, rowEnd: 0, columnEnd: 0 };
    const text = `$${index}`
    return { kind: TokenKind.VarIdentifier, text, pos, next: undefined, cellRef: cell };
  }

  tokenize(): Token<TokenKind> | undefined {
    let head: Token<TokenKind> | undefined = undefined;

    for (let i = 0; i < this._inputStrings.length; i++) {
      const strPart = this._inputStrings[i];
      if (strPart && strPart.length > 0) {
        const stringTokens = basicLexer.parse(strPart);

        if (!stringTokens) {
          throw new Error(`Failed to tokenize string part: ${strPart}`);
        }

        head = concatToken(head, stringTokens);
      }

      if (i < this._inputCells.length) {
        const cell = this._inputCells[i];
        if (!cell) {
          throw new Error(`Cell reference not found for index: ${i}`);
        }
        const cellToken = this.buildCellToken(cell, i);
        head = concatToken(head, cellToken);
      }
    }
    return head;
  }
}

type TokenData =
  | { kind: 'PExprData'; pExpr: PExpr}
  | { kind: 'NumberData'; number: number }
  | { kind: 'RangeData'; range: [number, number] }

function applyCellRef(token: Token<TokenKind.VarIdentifier>): TokenData {
    const varToken = token as VarIdentifierToken;
    if (varToken.cellRef !== undefined) {
        // If the tokenizer attached a CellRef, create a PExpr function that returns it.
        const knownCellRef = varToken.cellRef;
        const pExprFunc: PExpr = (net) => knownCellRef; // Wrap the known CellRef in a function
        return { kind: 'PExprData', pExpr: pExprFunc };
    } else {
        // Fallback for parsing strings without template literals or if cellRef is missing.
        // Try converting the text to a number first.
        const cellId = toNumber(token.text);
        if (!isNaN(cellId)) {
             // If it's a valid number, create a PExpr function that returns it.
             const knownCellRef = cellId as CellRef;
             const pExprFunc: PExpr = (net) => knownCellRef;
             return { kind: 'PExprData', pExpr: pExprFunc };
        }
        throw new Error(`Invalid cell reference: ${token.text}`);
    }
}

function getPExpr(tokenData: TokenData): PExpr {
  switch (tokenData.kind) {
    case 'PExprData':
      return tokenData.pExpr;
    case 'NumberData':
      return (net) => {
        return net.newCell(tokenData.number.toString(), known(exactly(tokenData.number)));
      }
    case 'RangeData':
      return (net) => {
        return net.newCell(`[${tokenData.range[0]},${tokenData.range[1]}]`, known(between(tokenData.range[0], tokenData.range[1])));
      }
    default:
       const exhaustiveCheck: never = tokenData;
       throw new Error(`Unsupported token data kind: ${(exhaustiveCheck as any)?.kind}`);
  }
}

function applyNumber(token: Token<TokenKind.Number>): TokenData {
  return { kind: 'NumberData', number: parseInt(token.text) };
}

function applyRangeLiteral(
    sequence: [Token<TokenKind.LBracket>, Token<TokenKind.Number>, Token<TokenKind.Comma>, Token<TokenKind.Number>, Token<TokenKind.RBracket>]
): TokenData {
    const min = parseInt(sequence[1].text);
    const max = parseInt(sequence[3].text);
    if (isNaN(min) || isNaN(max)) {
        throw new Error(`Invalid numbers in range literal: [${sequence[1].text}, ${sequence[3].text}]`);
    }
    if (min > max) {
        throw new Error(`Invalid range: minimum ${min} is greater than maximum ${max}`);
    }
    return { kind: 'RangeData', range: [min, max] };
}

function applyEqual(sequence: [TokenData, Token<TokenKind.Equal>, TokenData]): PropagatorRelation {
  const [first, token, second] = sequence;

  if (token.kind !== TokenKind.Equal) {
    throw new Error(`Expected equal token, got: ${token.kind}`);
  }

  const firstPExpr = getPExpr(first);
  const secondPExpr = getPExpr(second);

  return equal(firstPExpr, secondPExpr);
}

// TODO
// // expr = OP expr
// function applyEqualUnary(first: TokenData, second: [Token<TokenKind>, TokenData]): PropagatorRelation {
//   const [token, secondData] = second;
// }

// expr = expr OP expr
function applyEqualBinary(sequence: [TokenData, Token<TokenKind.Equal>, TokenData, Token<TokenKind>, TokenData]): PropagatorRelation {
  const [lhsData, op, op1Data, opToken, op2Data] = sequence;

  const lhsPExpr = getPExpr(lhsData);
  const op1PExpr = getPExpr(op1Data);

  switch (opToken.kind) {
    case TokenKind.Add:
      return (net: PropagatorNetwork<NumericRange>) => {
        const op2PExpr = getPExpr(op2Data);

        return addRangePropagator(
          `${lhsPExpr} = ${op1PExpr} + ${op2PExpr}`,
          net,
          getCellRef(net, op1PExpr),
          getCellRef(net, op2PExpr),
          getCellRef(net, lhsPExpr)
        )
      }
    case TokenKind.Sub:
      return (net: PropagatorNetwork<NumericRange>) => {
        const op2PExpr = getPExpr(op2Data);

        return subtractRangePropagator(
          `${lhsPExpr} = ${op1PExpr} - ${op2PExpr}`,
          net,
          getCellRef(net, op1PExpr),
          getCellRef(net, op2PExpr),
          getCellRef(net, lhsPExpr)
        )
      }
    case TokenKind.MulNum: {
      if (op2Data.kind !== 'NumberData') {
        throw new Error(`Unsupported second operand for MulNum: ${op2Data.kind}`);
     }

      const op2 = op2Data.number

      return (net: PropagatorNetwork<NumericRange>) => {
        return multNumericRangeNumberPropagator(
          `${lhsPExpr} = ${op1PExpr} * ${op2}`,
          net,
          getCellRef(net, op1PExpr),
          op2,
          getCellRef(net, lhsPExpr),
        )
      }
    }
    case TokenKind.DivNum:
      if (op2Data.kind !== 'NumberData') {
        throw new Error(`Unsupported second operand for DivNum: ${op2Data.kind}`);
      }

      const op2 = op2Data.number

      return (net: PropagatorNetwork<NumericRange>) => {
        return divNumericRangeNumberPropagator(
          `${lhsPExpr} = ${op1PExpr} / ${op2}`,
          net,
          getCellRef(net, op1PExpr),
          op2,
          getCellRef(net, lhsPExpr),
        )
      }
    default:
      throw new Error(`Unsupported ternary operation token: ${opToken.kind}`);
  }
}

function applyBinary(first: TokenData, second: [Token<TokenKind>, TokenData]): TokenData {
  const [token, secondData] = second;

  const firstPExpr = getPExpr(first);
  const secondPExpr = getPExpr(secondData);

  switch (token.kind) {
    case TokenKind.Add:
      return pExprTokenData(add(firstPExpr, secondPExpr));
    case TokenKind.Sub:
      return pExprTokenData(sub(firstPExpr, secondPExpr));
    case TokenKind.MulNum:
       if (secondData.kind === 'NumberData') {
         return pExprTokenData(multNumber(firstPExpr, secondData.number));
       }
       throw new Error(`Unsupported second operand for MulNum: ${secondData.kind}`);
    case TokenKind.DivNum:
       if (secondData.kind === 'NumberData') {
         return pExprTokenData(divNumber(firstPExpr, secondData.number));
       }
       throw new Error(`Unsupported second operand for DivNum: ${secondData.kind}`);
    default:
      throw new Error(`Unsupported binary operation token: ${token.kind}`);
  }
}

function applyUnary(token: Token<TokenKind>, data: TokenData | TokenData[]): TokenData {
  switch (token.kind) {
    case TokenKind.AddList:
    case TokenKind.MaxList:
    case TokenKind.MinList:
      if (!Array.isArray(data)) {
        throw new Error(`Expected TokenData[] for list operation ${token.kind}`);
      }
      const pExprList = data.map(getPExpr);
      if (token.kind === TokenKind.AddList) return pExprTokenData(addList(pExprList));
      if (token.kind === TokenKind.MaxList) return pExprTokenData(maxList(pExprList));
      if (token.kind === TokenKind.MinList) return pExprTokenData(minList(pExprList));
      break; // Should be unreachable
    case TokenKind.Sub:
      if (Array.isArray(data)) {
         throw new Error(`Expected single TokenData for negation`);
      }
      return pExprTokenData(negate(getPExpr(data)));
    default:
      throw new Error(`Unsupported unary operation: ${token.kind}`);
  }

  throw new Error(`Unhandled unary operation case for token: ${token.kind}`);
}

function pExprTokenData(pExpr: PExpr): TokenData {
  return { kind: 'PExprData', pExpr };
}

const ATOM = rule<TokenKind, TokenData>();
const EXPR = rule<TokenKind, TokenData>();
const REL = rule<TokenKind, PropagatorRelation>()
const ARG_LIST = list_sc(EXPR, str(','));

const binOp: Parser<TokenKind, Token<TokenKind>> =
  alt(
    tok(TokenKind.Add),
    tok(TokenKind.Sub),
    tok(TokenKind.MulNum),
    tok(TokenKind.DivNum)
  );

// REL =
// | COMPOUND_EXPR '=' EXPR
// | EXPR '=' COMPOUND_EXPR
REL.setPattern(
  alt(
    apply(seq(EXPR, tok(TokenKind.Equal), EXPR, binOp, EXPR), applyEqualBinary),
    apply(seq(EXPR, tok(TokenKind.Equal), EXPR), applyEqual),
  )
)

// ATOM = CELLREF | NUMBER | RANGE_LITERAL | '-' ATOM | FUNCTION_CALL(...) | '(' EXPR ')'
ATOM.setPattern(
  alt(
    apply(tok(TokenKind.VarIdentifier), applyCellRef),
    apply(tok(TokenKind.Number), applyNumber),

    apply(
        seq(
            tok(TokenKind.LBracket),
            tok(TokenKind.Number),
            tok(TokenKind.Comma),
            tok(TokenKind.Number),
            tok(TokenKind.RBracket)
        ),
        applyRangeLiteral
    ),

    // Unary negation
    apply(seq(tok(TokenKind.Sub), ATOM), ([op, data]) => applyUnary(op, data)),

    // Function calls: func(arg1, arg2, ...)
    apply(seq(tok(TokenKind.AddList), kmid(str('('), ARG_LIST, str(')'))), ([op, args]) => applyUnary(op, args)),
    apply(seq(tok(TokenKind.MaxList), kmid(str('('), ARG_LIST, str(')'))), ([op, args]) => applyUnary(op, args)),
    apply(seq(tok(TokenKind.MinList), kmid(str('('), ARG_LIST, str(')'))), ([op, args]) => applyUnary(op, args)),

    // Parentheses
    kmid(tok(TokenKind.LParen), EXPR, tok(TokenKind.RParen))
  )
);

// EXPR = ATOM (binOp ATOM)*
EXPR.setPattern(
  lrec_sc(ATOM, seq(binOp, ATOM), applyBinary)
);

export function parsePropagatorExpr(input: string): PExpr {
    const tokenizer = new Tokenizer(input.split(/(\$\d+)/).filter(s => s), []);
    const tokens = tokenizer.tokenize();
    if (!tokens) {
        throw new Error("Lexing failed: No tokens produced.");
    }
    const parseResult = EXPR.parse(tokens);
    return getPExpr(expectSingleResult(parseResult));
}

export function runPropagatorExpr(input: TemplateStringsArray, ...inputCells: CellRef[]) {
  const tokenizer = new Tokenizer(Array.from(input.values()), inputCells);
  const tokens = tokenizer.tokenize();
  if (!tokens) {
    throw new Error("Lexing failed: No tokens produced.");
  }
  const parseResult = EXPR.parse(tokens);

  return (net: PropagatorNetwork<NumericRange>) => runPExpr(net, getPExpr(expectSingleResult(parseResult)));
}

export function runPropagatorRelation(input: TemplateStringsArray, ...inputCells: CellRef[]) {
  const tokenizer = new Tokenizer(Array.from(input.values()), inputCells);
  const tokens = tokenizer.tokenize();
  if (!tokens) {
    throw new Error("Lexing failed: No tokens produced.");
  }
  const parseResult = REL.parse(tokens);

  return (net: PropagatorNetwork<NumericRange>) => {
    return expectSingleResult(parseResult)(net);
  }
}

function runPExpr(net: PropagatorNetwork<NumericRange>, expr: PExpr): PropagatorRelation {
  return (net) => {
    const cellRef = getCellRef(net, expr);
    return cellRef;
  }
}
