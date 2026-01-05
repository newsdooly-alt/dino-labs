## Packages
recharts | For stock charts and XP progress visualization
framer-motion | For smooth animations, page transitions, and quest completion effects
lucide-react | Icon system (already in base, but emphasizing use)
canvas-confetti | For celebration effects when quests are completed
clsx | For conditional class names
tailwind-merge | For merging tailwind classes

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  sans: ["var(--font-sans)"],
  display: ["var(--font-display)"],
  mono: ["var(--font-mono)"],
}
API uses @shared/routes contract.
Authentication is simplified for MVP (userId=1).
