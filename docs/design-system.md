# MiniLedger — Design System & UI Blueprint

## 1. Visual Philosophy & Identity

MiniLedger's interface is designed as an intentional, understated fintech application. It prioritizes clarity, trust, high readability, and precision over decorative trends.

### Core Principles
- **Clarity over Clutter:** Every element on screen serves a financial or navigational purpose. No arbitrary gradients, floating decorative 3D shapes, or excessive glassmorphism.
- **Financial Legibility:** Numbers and currency values use tabular figures (`fontVariant: ['tabular-nums']`) to align cleanly in columns and card headers.
- **Accessible State Signaling:** Color is paired with iconography and text labels so state (Overdue, Active, Repaid) is never conveyed by color alone.
- **Native Precision:** Smooth touch interactions, platform-standard haptic pulses, and native modal presentations.

---

## 2. Design Tokens

### 2.1 Color Palette
The color tokens use semantic scales built on a modern slate and neutral foundation:

| Token Name | Hex Code | Purpose & Usage |
| :--- | :--- | :--- |
| `background` | `#F8FAFC` | Primary app canvas background (warm off-white / slate-50) |
| `surface` | `#FFFFFF` | Card surfaces, modal sheets, input backgrounds |
| `surfaceSubtle` | `#F1F5F9` | Secondary background, pill tag backgrounds (slate-100) |
| `border` | `#E2E8F0` | Default 1px borders, subtle card outlines (slate-200) |
| `borderFocus` | `#2563EB` | Active input border focus state (blue-600) |
| `textPrimary` | `#0F172A` | Primary typography, headers, main numbers (slate-900 ink) |
| `textSecondary` | `#475569` | Secondary body text, dates, subheadings (slate-600) |
| `textMuted` | `#94A3B8` | Input placeholders, captions, disabled text (slate-400) |
| `brandPrimary` | `#0F172A` | Primary button background, brand anchor |
| `brandAccent` | `#2563EB` | Interactive links, active tab indicators, primary focus |

### 2.2 Semantic Financial Status Tokens

| Status | Text Color | Background Pill | Border Tint | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Overdue** | `#DC2626` (Red-600) | `#FEF2F2` (Red-50) | `#FECACA` (Red-200) | Highlight overdue cards, amount totals, urgent alerts |
| **Active / Pending** | `#D97706` (Amber-600) | `#FFFBEB` (Amber-50) | `#FDE68A` (Amber-200) | Outstanding loans currently before due date |
| **Repaid / Settled** | `#059669` (Emerald-600)| `#ECFDF5` (Emerald-50)| `#A7F3D0` (Emerald-200)| Settled loans, total repaid card, success confirmations |

### 2.3 Typography Scale
System fonts (`System` on iOS / `Roboto` on Android) provide native rendering speed and consistency:

```typescript
export const Typography = {
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '600', lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 24, letterSpacing: -0.2 },
  bodyLarge: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 20 },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0.2 },
  currencyHero: { fontSize: 32, fontWeight: '700', lineHeight: 38, fontVariant: ['tabular-nums'] },
  currencyCard: { fontSize: 20, fontWeight: '700', lineHeight: 26, fontVariant: ['tabular-nums'] },
  currencyRow: { fontSize: 16, fontWeight: '600', lineHeight: 22, fontVariant: ['tabular-nums'] }
} as const;
```

### 2.4 Spacing Scale
A consistent 4px / 8px grid ensures alignment across form fields, cards, and modal padding:
```typescript
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screenPadding: 16
} as const;
```

### 2.5 Radii & Elevation
- `radii.sm`: 6px (Badges, tags)
- `radii.md`: 10px (Inputs, buttons)
- `radii.lg`: 16px (Cards, modal sheets)
- `radii.full`: 9999px (Circular avatars, status pills)
- **Borders over Shadows:** Standard cards use a crisp `1px solid #E2E8F0` border. Shadows are restrained to standard iOS/Android light elevation for modals and floating action buttons.

---

## 3. Component Architecture & Patterns

### 3.1 Financial Summary Card
The summary card sits prominently at the top of the main dashboard:
- **Hero Metric:** Outstanding Balance (`totalLent - totalRepaid`).
- **Sub-Metrics Columns:**
  1. *Total Lent:* Total money recorded across all loans.
  2. *Total Repaid:* Total amount returned.
  3. *Overdue Amount:* Displayed in high-visibility Red (`#DC2626`) badge to prompt collection action.

### 3.2 Loan List Card
Each loan card renders:
- Borrower/Friend Name in bold (`h3`).
- Due Date with relative indicator (e.g. "Due in 3 days" or "Overdue by 5 days").
- Amount formatted with currency symbol and tabular numbers.
- Semantic Status Badge: `ACTIVE`, `OVERDUE`, or `REPAID`.
- Distinct visual accent: Overdue cards display a 3px crimson left border stripe or tinted card background.

### 3.3 Form Inputs & Validation
- **Floating/Affiliated Labels:** Clear labels and currency prefix (`$`) inside amount inputs.
- **Immediate Inline Validation:** Real-time feedback for negative numbers, zero amounts, or empty names.
- **Keypad Adaptation:** Amount input uses `keyboardType="decimal-pad"`. Phone input uses `keyboardType="phone-pad"`.

### 3.4 State Feedback
- **Skeleton Shimmers:** Subtle animated placeholders for summary cards and list rows during loading.
- **Empty States:** A friendly, helpful zero-state when no loans are recorded ("No loans recorded yet. Tap + to record money lent to a friend").
- **Action Feedback:** Haptic feedback on Android/iOS when successfully creating a loan or marking a loan as repaid.
