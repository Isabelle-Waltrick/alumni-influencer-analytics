// ─────────────────────────────────────────────────────────────────────────────
// components/FilterCombobox.tsx — Accessible type-ahead dropdown input
//
// A custom replacement for the native HTML <datalist> element, which renders
// inconsistently across browsers (especially on mobile Safari and Firefox).
//
// How it works:
//   1. The user types into a regular <input>. As they type, the list of options
//      is filtered down to only items containing the typed text.
//   2. A dropdown <ul> appears below the input showing the matching options.
//   3. Clicking (or tapping) an option fills the input and closes the dropdown.
//   4. Clicking outside the component or pressing Escape also closes it.
//   5. A small chevron button on the right lets users open/close without typing.
//
// Used by FiltersBar.tsx for the Program and Industry Sector fields.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'

/**
 * Accessible, type-ahead combobox used for the Program and Industry Sector filter fields.
 * Replaces the native <datalist> which renders inconsistently across browsers.
 * The dropdown is rendered inside a `position: relative` wrapper so it always
 * matches the input width, regardless of the parent grid column width.
 */
type Props = {
    id: string
    label: string
    placeholder?: string
    value: string
    onChange: (value: string) => void
    /** Full sorted list of options; the component handles filtering down to matches. */
    options: string[]
}

export const FilterCombobox = ({ id, label, placeholder, value, onChange, options }: Props) => {
    const [open, setOpen] = useState(false)
    // Ref used to detect clicks that land outside this component so the dropdown can close.
    const containerRef = useRef<HTMLDivElement>(null)

    // When the user has typed something, show only options containing that text (case-insensitive).
    // When the field is empty, show the full alphabetical list so users can browse.
    const filtered = value.trim()
        ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase()))
        : options

    // Close dropdown when the user clicks outside the component.
    // Uses `pointerdown` (fires before `blur`) so the click-outside detection works on touch devices.
    useEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [])

    // Commit the selected value and close the dropdown.
    const selectOption = (option: string) => {
        onChange(option)
        setOpen(false)
    }

    // Allow keyboard users to dismiss the dropdown without clearing the field.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') setOpen(false)
    }

    return (
        // The wrapper must be `relative` so the absolutely-positioned dropdown
        // is constrained to the same width as the input above it.
        <div ref={containerRef} className="relative space-y-1">
            <label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</label>
            <div className="relative">
                <input
                    id={id}
                    autoComplete="off" // Disable browser autofill so it does not compete with the custom list.
                    className="w-full rounded-md border border-slate-300 p-2 pr-8 text-sm focus:border-slate-500 focus:outline-none"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => { onChange(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)} // Always show options on focus so users can browse without typing.
                    onKeyDown={handleKeyDown}
                />
                {/* Chevron button — tabIndex={-1} keeps it out of the tab order so it does not interrupt keyboard navigation. */}
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label={open ? 'Close options' : 'Show options'}
                    className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-slate-400 hover:text-slate-600"
                    onClick={() => setOpen((prev) => !prev)}
                >
                    {/* Chevron SVG rotates 180° when the dropdown is open via Tailwind transition. */}
                    <svg
                        className={`h-4 w-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            </div>

            {/* Dropdown list — only rendered when open and there are matching options.
          `left-0 right-0` makes it exactly as wide as the input above.
          `z-20` lifts it above other filter fields in the same grid row.
          `onPointerDown` with `e.preventDefault()` prevents the input's `blur` event
          from firing before the click is registered, which would close the list too early. */}
            {open && filtered.length > 0 && (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
                >
                    {filtered.map((option) => (
                        <li
                            key={option}
                            role="option"
                            aria-selected={value === option} // Marks the currently selected value for screen readers.
                            onPointerDown={(e) => { e.preventDefault(); selectOption(option) }}
                            className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-100 ${value === option ? 'bg-slate-50 font-medium text-slate-900' : 'text-slate-700'}`}
                        >
                            {option}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
