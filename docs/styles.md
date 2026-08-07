# Stylesheet Architecture

Back to [Project Context](../CONTEXT.md).

`src/index.css` is the single global entry point. It imports plain CSS files in
the same order as the former monolithic stylesheet, so existing class names,
specificity, theme behavior, animations, and responsive overrides keep their
original cascade.

## Required import order

1. `styles/foundation.css` — universal reset rules that must precede every
   product surface.
2. `styles/admin.css` — administration dashboard, operations, dialogs, admin
   dark mode, and admin responsive rules.
3. `styles/base.css` — tokens, light/dark themes, document defaults, shared
   controls, authentication layout, application shell, and shared utilities.
4. `styles/homepage.css` — homepage header, hero, account and pricing panels,
   content cards, tours, cart, cookie consent, and floating actions.
5. `styles/overlays.css` — featured-tour reservation drawer, bird-identification, authentication, cart, and account overlays
   modal, and their overlay-specific descendants.
6. `styles/chat.css` — chat notices, transcript, message content, reservation and
   bird-media cards, composer, voice controls, and chat animations.
7. `styles/responsive.css` — the final cross-surface dark-mode, reduced-motion,
   and viewport overrides. This is deliberately last because some media queries
   coordinate homepage, overlay, shared-shell, and chat selectors.

## Adding styles

Put a rule in the file owned by the surface that renders its selector. Put
tokens, resets, shared shell primitives, and controls used by multiple surfaces
in `base.css`. Put fixed dialogs, drawers, backdrops, and modal-only descendants
in `overlays.css`. Add an override to `responsive.css` only when it coordinates
multiple responsibility files or must remain at the final cascade position;
otherwise keep the media query beside its owning surface.

Do not duplicate shared declarations to avoid import-order reasoning. If a rule
must override an earlier surface rule, document that relationship beside the
rule and preserve the entry-point order above.
