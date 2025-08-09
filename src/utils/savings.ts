// SPDX-FileCopyrightText: 2024 AFCMS <afcm.contact@gmail.com>
// SPDX-License-Identifier: MIT

import { OxipngSavings } from "../api/optimiser";

/**
 * Returns a string describing the savings in bytes and percentage.
 */
export function savingsString(s: OxipngSavings): string {
    return s.in_len >= s.out_len
        ? `${s.out_len} bytes (${(((s.in_len - s.out_len) / s.in_len) * 100).toFixed(2)}% smaller)`
        : `${s.out_len} bytes (${(((s.out_len - s.in_len) / s.in_len) * 100).toFixed(2)}% larger)`;
}

export function savingsStringPercent(s: OxipngSavings): string {
    return s.in_len >= s.out_len
        ? `(${(((s.in_len - s.out_len) / s.in_len) * 100).toFixed(2)}% smaller)`
        : `(${(((s.out_len - s.in_len) / s.in_len) * 100).toFixed(2)}% larger)`;
}
