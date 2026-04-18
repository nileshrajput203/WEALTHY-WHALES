# GenAI-Stock - Professional Stock Analysis Platform

## Overview

GenAI-Stock is a professional stock analysis platform focused on Indian markets (NSE/BSE). It provides AI-powered insights, live market data, expert stock recommendations, and trading tools. The platform features a dark-themed financial UI with real-time data visualization, stock scanners, news feeds, and an AI chatbot for market analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18+ with TypeScript as the primary framework
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query (React Query) for server state management and data fetching

**UI Component System**
- Radix UI primitives for accessible, unstyled components
- Shadcn/ui component library built on Radix UI ("new-york" style variant)
- Tailwind CSS for styling with custom design tokens
- Custom color system supporting dark mode (primary theme) and optional light mode
- Financial-specific design with Inter font for UI and JetBrains Mono for numerical data

**Design Principles**
- Material Design-influenced system with financial enhancements
- Dark mode primary theme (deep navy-charcoal backgrounds)
- Color-coded financial data (green for bullish, red for bearish, purple for primary actions)
- Information hierarchy through color and spacing rather than decoration

**Key UI Patterns**
- Stock recommendation cards with buy/sell/hold badges
- Real-time marquee ticker for market indices
- Scanner tables for swing trading and IPO analysis
- Chat interface for AI interactions
- Modal-based authentication flows

### Backend Architecture

**Server Framework**
- Express.js on Node.js with TypeScript
- ESM module system (type: "module")
- Development mode with tsx, production builds with esbuild

**API Design**
- RESTful endpoints under `/api` namespace
- Session-based authentication with cookie storage
- Protected routes using authentication middleware
- Standardized error handling with status codes and JSON responses

**Key API Endpoints**
- `/api/auth/*` - Authentication flows
- `/api/recommendations` - Stock recommendations CRUD
- `/api/chat` - AI chatbot interactions
- `/api/scanner/*` - Market scanner data (swing, IPO)
- `/api/news` - Market news feed
- `/api/indices` - Real-time index data

### Data Architecture

**ORM & Database Layer**
- Drizzle ORM for type-safe database operations
- PostgreSQL as the primary database (via Neon serverless)
- WebSocket-based database connection for serverless compatibility
- Schema-first design with TypeScript types derived from Drizzle schemas

**Core Data Models**
- `users` - User profiles with admin flags
- `sessions` - Express session storage (PostgreSQL-backed)
- `stockRecommendations` - Admin-curated stock picks with targets and stop-loss
- `chatMessages` - AI conversation history with session-based grouping
- `scannerData` - Market scanner results (swing, IPO, etc.)
- `newsItems` - Financial news articles and updates

**Data Validation**
- Zod schemas for runtime validation
- Drizzle-zod integration for insert/update schema generation
- Type safety from database to API to frontend

### Authentication System

**Replit Auth (OIDC)**
- OpenID Connect based authentication
- Session management with PostgreSQL store (connect-pg-simple)
- 7-day session TTL with secure, HTTP-only cookies
- User profile synchronization (email, name, avatar)
- Admin role support for content management

**Security Features**
- CSRF protection through session-based auth
- Secure cookie configuration (httpOnly, secure flags)
- Environment-based session secrets
- 401 error handling with graceful degradation

## External Dependencies

### AI & Machine Learning
- **Google Gemini AI** (via @google/genai SDK)
  - Model: gemini-2.5-flash for financial advice
  - System prompts tailored for Indian stock market expertise
  - Context-aware responses with risk disclaimers
  - API key authentication via environment variables

### Database & Hosting
- **Neon PostgreSQL** (serverless PostgreSQL)
  - WebSocket-based connections (@neondatabase/serverless)
  - Connection pooling for performance
  - DATABASE_URL environment variable for connection string

### Authentication
- **Replit Auth** (OpenID Connect provider)
  - Discovery URL: https://replit.com/oidc
  - Client credentials via REPL_ID and environment variables
  - Passport.js strategy for session management

### UI Component Libraries
- **Radix UI** - Headless, accessible component primitives
  - Dialog, Dropdown, Popover, Tooltip, and 20+ other components
  - Full keyboard navigation and ARIA support
  
- **Shadcn/ui** - Pre-styled component implementations
  - Built on Radix UI with Tailwind CSS
  - Customizable through CSS variables and Tailwind config

### Development Tools
- **Replit-specific plugins** (development only)
  - Runtime error overlay modal
  - Cartographer for code navigation
  - Development banner for environment awareness

### Styling & Utilities
- **Tailwind CSS** - Utility-first CSS framework
- **class-variance-authority** - Type-safe variant styling
- **clsx** & **tailwind-merge** - Conditional class composition
- **date-fns** - Date formatting and manipulation

### Session Storage
- **connect-pg-simple** - PostgreSQL session store for Express
  - Automatic session table management
  - TTL-based session expiration