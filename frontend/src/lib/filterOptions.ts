import type { AlumniRow } from '../types'

/**
 * Utility functions that derive alphabetically-sorted, deduplicated option lists
 * from the alumni dataset returned by useAnalytics.
 * Both functions are called inside `useMemo` on each page so they only recompute
 * when the underlying alumni array changes.
 */

// Trim whitespace from a raw field value before deduplication.
const normalizeOption = (value: string) => value.trim()

/**
 * Extracts every unique degree-program title across all alumni.
 * Each alumnus can hold multiple programs (one per degree), so the array is
 * flattened before deduplication.
 * Returns options sorted A→Z (case-insensitive locale sort).
 */
export const buildProgramOptions = (alumni: AlumniRow[]) => (
    Array.from(
        new Set(
            alumni
                .flatMap((person) => person.programs || []) // each alumnus may have multiple degrees
                .map(normalizeOption)
                .filter(Boolean) // drop any blank entries
        )
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
)

/**
 * Extracts the latest industry sector from each alumnus record.
 * Only one value per person is used (their most recent employment industry)
 * so no flattening is needed — just deduplicate and sort.
 * Returns options sorted A→Z (case-insensitive locale sort).
 */
export const buildIndustryOptions = (alumni: AlumniRow[]) => (
    Array.from(
        new Set(
            alumni
                .map((person) => normalizeOption(person.latestIndustry || ''))
                .filter(Boolean) // drop alumni without an industry record
        )
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
)
