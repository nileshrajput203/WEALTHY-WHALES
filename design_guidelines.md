# Design Guidelines: Professional Stock Analysis Platform

## Design Approach
**System-Based with Financial UI Enhancement**: This information-dense trading platform requires the clarity and consistency of Material Design principles, enhanced with financial data visualization patterns inspired by platforms like TradingView, Robinhood, and Zerodha.

**Core Principles:**
- Information hierarchy through color and spacing, not excessive decoration
- Trust-building through professional, clean layouts
- Quick scanability for time-sensitive financial data
- Visual feedback for real-time data changes

---

## Color Palette

### Dark Mode (Primary Theme)
**Background Colors:**
- Primary Background: 220 26% 14% (deep navy-charcoal)
- Secondary Background: 220 20% 18% (elevated surfaces)
- Tertiary Background: 220 18% 22% (cards, modals)

**Brand & Accent Colors:**
- Primary Brand: 270 70% 60% (vibrant purple for CTAs, highlights)
- Success/Bullish: 142 76% 45% (vivid green for gains, buy signals)
- Danger/Bearish: 0 84% 60% (bright red for losses, sell signals)
- Info/Neutral: 217 91% 60% (blue for hold, informational states)

**Text Colors:**
- Primary Text: 0 0% 98%
- Secondary Text: 220 10% 70%
- Muted Text: 220 8% 50%

### Light Mode (Optional Support)
- Primary Background: 0 0% 98%
- Card Background: 0 0% 100%
- Text: 220 26% 14%
- Maintain same accent colors with adjusted saturation

---

## Typography

**Font Stack:**
- Primary: 'Inter' from Google Fonts (clean, modern, excellent for data)
- Monospace: 'JetBrains Mono' for numerical data, stock codes, prices

**Scale & Usage:**
- **Display (Hero)**: text-4xl/5xl font-bold (page titles, major headings)
- **Heading 1**: text-2xl/3xl font-semibold (section headers)
- **Heading 2**: text-xl font-semibold (card titles, subsections)
- **Body Large**: text-base font-medium (primary content, labels)
- **Body**: text-sm (descriptions, secondary info)
- **Caption/Data**: text-xs font-mono (stock prices, percentages, timestamps)

**Special Typography:**
- Stock symbols: UPPERCASE, font-mono, tracking-wide
- Price values: font-mono with tabular numbers
- Percentage changes: font-semibold with +/- prefix

---

## Layout System

**Spacing Primitives (Tailwind Units):**
- Micro spacing: 1, 2 (tight elements, icon gaps)
- Component spacing: 3, 4, 6 (internal padding, gaps)
- Section spacing: 8, 12, 16 (between major sections)
- Page margins: 20, 24, 32 (desktop outer spacing)

**Grid Structure:**
- Container: max-w-7xl with px-4 md:px-6 lg:px-8
- Sidebar Layout: Fixed 280px sidebar + flex-1 main content
- Card Grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 with gap-6
- Data Tables: Full width with horizontal scroll on mobile

**Responsive Breakpoints:**
- Mobile: Base styles (stack everything)
- Tablet: md: (2-column layouts)
- Desktop: lg: (full multi-column, sidebar visible)

---

## Component Library

### Navigation
**Sidebar Navigation:**
- Fixed left sidebar (280px) with dark background
- Menu items with icons (Heroicons), text-sm, hover:bg-secondary
- Active state: purple accent border-left (border-l-4) + purple text
- Collapsible on mobile (hamburger menu)

**Top Bar:**
- Sticky header with z-50
- Logo left, search center, user/auth right
- Height: h-16 with shadow-lg

### Marquee Ticker
- Full-width scrolling banner below header
- Background: slightly lighter than header (220 20% 16%)
- Display: Index name + value + percentage with animated scroll
- Green/Red dynamic coloring based on gain/loss
- Font: font-mono text-sm
- Speed: Smooth continuous scroll (60-80px/second)

### Cards & Containers
**Stock Card (Admin Posts - Image 3 Style):**
- Background: tertiary with border border-gray-700
- Rounded: rounded-xl
- Padding: p-6
- Structure: Stock symbol header → "Reason to Buy" section → Target/SL grid
- Shadow: shadow-xl with subtle purple glow on hover

**Analysis Card (Tabbed Interface):**
- Tabs: border-b with active indicator (border-b-2 purple)
- Content area: p-6 min-h-[400px]
- Tab buttons: px-4 py-2 text-sm font-medium

### Data Display Components
**Stock Price Display:**
- Large price: text-3xl font-mono font-bold
- Change value: text-lg with red/green + arrow icons
- Timestamp: text-xs text-muted below

**Recommendation Badge:**
- BUY: bg-green/20 text-green border-green
- SELL: bg-red/20 text-red border-red  
- HOLD: bg-blue/20 text-blue border-blue
- Styling: px-4 py-2 rounded-full font-semibold text-sm

**Data Table:**
- Zebra striping: even:bg-secondary/50
- Header: bg-tertiary text-sm font-semibold uppercase tracking-wide
- Cells: py-3 px-4 border-b border-gray-700
- Hover: hover:bg-secondary/70

### Interactive Elements
**Search Bar:**
- Width: w-full max-w-2xl (centered in header)
- Style: bg-tertiary rounded-lg px-4 py-2.5 with search icon
- Autocomplete: dropdown with stock symbols, names, shadow-2xl

**Buttons:**
- Primary CTA: bg-purple text-white px-6 py-2.5 rounded-lg font-semibold
- Secondary: variant="outline" with purple border
- Ghost: text-purple hover:bg-purple/10
- Sizes: Default py-2.5, Large py-3.5, Small py-1.5

**Authentication Modal:**
- Centered overlay with backdrop-blur
- Card: max-w-md bg-tertiary rounded-2xl p-8
- "Skip" button: text-purple in top-right corner
- Form fields: bg-secondary rounded-lg border-gray-600

### Charts & Visualizations
**Stock Chart:**
- Library: Lightweight Charts or Chart.js
- Colors: Green candles (bullish), Red candles (bearish)
- Grid: Subtle gray lines (opacity-20)
- Tooltip: Dark background with price/time data

**Scanner Results:**
- List/Grid toggle view
- Each item: Mini chart thumbnail + stock data + action button
- Compact spacing for scanning multiple stocks

---

## Special Patterns

### AI Chat Interface
- Fixed bottom-right: w-96 h-[600px] (desktop)
- Header: Purple gradient with Gemini icon
- Messages: User (right, purple bg), AI (left, secondary bg)
- Input: Sticky bottom with send button

### Admin Stock Posts (Image 3)
- Hero card layout with stock symbol prominent
- "Reason to Buy" section with bullet points
- Target Price & Stop Loss in grid (2 columns)
- CTA button "View Full Analysis"

### Stock Analysis Page (Image 2)
- Split view: Chart (60%) + Quick Stats sidebar (40%)
- Tabs: Fundamental | Technical | Seasonality
- Each tab: Organized data in labeled rows/cards
- Buy/Sell indicators: Large visual badges with confidence score

---

## Images & Media

**Hero Section:**
- Not applicable - dashboard-style homepage leads with live data marquee and quick actions

**Stock Cards:**
- Company logos (circular avatars, 48x48px)
- Chart thumbnails for scanner results

**Placeholder Images:**
- Stock logos: Use letter avatars with stock symbol if logo unavailable
- Charts: Generate via API or use placeholder gradient

---

## Animation & Interaction

**Micro-interactions (Minimal):**
- Marquee: Continuous smooth scroll
- Live price updates: Subtle flash animation (green/red pulse)
- Card hover: Subtle scale(1.02) with shadow increase
- Modal entry: Fade + scale from 95% to 100%

**Avoid:**
- Heavy page transitions
- Distracting background animations
- Auto-playing videos

---

## Accessibility & Performance

- Dark mode default with light mode toggle
- Focus states: 2px purple outline
- Color-blind safe: Use icons alongside red/green (↑↓ arrows)
- Keyboard navigation for all interactive elements
- Loading states: Skeleton screens for data-heavy sections
- Optimistic UI updates for real-time data