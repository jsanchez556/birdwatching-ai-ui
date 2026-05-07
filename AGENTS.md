# UI Domain Agent Guidance

## Purpose
The UI layer delivers a polished chat experience, responsive experiences, and reusable component patterns for AI-first interactions.

## Stack
- React 18
- Vite
- Tailwind CSS / utility-first styling
- shadcn/ui-ready component architecture

## Component Organization
- Prefer feature folders under `src/components`
- Keep presentational and stateful concerns separated
- Use hooks for reusable behavior and side effects
- Create small, composable components for chat bubbles, lists, and controls

## Chat UI Patterns
- Display clear speaker roles: user vs assistant
- Use message grouping and avatars for continuity
- Provide typing/loading indicators for AI responses
- Preserve scroll position for ongoing conversation

## Responsive Design
- Design mobile-first and scale to desktop
- Use safe spacing and accessible touch targets
- Support dark mode with semantic color tokens

## Accessibility
- Use ARIA labels for buttons and status indicators
- Ensure keyboard interaction for message input and send actions
- Keep color contrast high and forms accessible

## Reusable UI Philosophy
- Build primitive components first: buttons, cards, text fields
- Use design tokens for spacing, typography, and color
- Keep UI state predictable and declarative
