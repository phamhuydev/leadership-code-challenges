import BigNumber from 'bignumber.js';
import { dec, ZERO } from '../lib/money';
import { DomainError } from './errors';

const MAX_INTEGER_DIGITS = 18;
const MAX_DECIMAL_PLACES = 18;

/**
 * Validates an amount before it reaches Postgres and formats it consistently.
 * Keeping this at the service boundary prevents a caller from silently losing
 * precision when Postgres stores its DECIMAL(36, 18) value.
 */
export function positiveMoney(value: string): BigNumber {
  const amount = dec(value);
  if (!amount.gt(ZERO)) {
    throw new DomainError(400, 'invalid_amount');
  }
  assertStorableMoney(amount);
  return amount;
}

/** Formats an already validated monetary value for DECIMAL(36, 18) storage. */
export function moneyString(value: BigNumber): string {
  assertStorableMoney(value);
  return value.toFixed(MAX_DECIMAL_PLACES);
}

export function assertStorableMoney(value: BigNumber): void {
  const decimalPlaces = value.decimalPlaces();
  if (!value.isFinite() || decimalPlaces === null || decimalPlaces > MAX_DECIMAL_PLACES) {
    throw new DomainError(400, 'invalid_amount');
  }

  const integerPart = value.abs().integerValue(BigNumber.ROUND_DOWN).toFixed(0);
  if (integerPart.length > MAX_INTEGER_DIGITS) {
    throw new DomainError(400, 'invalid_amount');
  }
}
