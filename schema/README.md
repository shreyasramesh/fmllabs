# Schema Directory

JSON Schemas for validating YAML content (mental models, perspective decks). YAML files include `yaml-language-server` schema directives for inline validation in editors that support it (e.g., VS Code with the YAML extension).

## Schema Files

| File | Purpose |
|------|---------|
| **Mental models** | |
| `mental-model-schema.json` | Single mental model or cognitive bias entry |
| `mental-models-consolidated-schema.json` | One-file-per-language format (array of models) |
| **Perspective decks** | |
| `perspective-deck-schema.json` | Single deck (id, name, description, cards) |
| `perspective-deck-index-schema.json` | Index of decks (paths, descriptions) |
| `perspective-card-schema.json` | Single card within a deck (referenced by deck schema) |

## Mental Models

Each mental model has: `id`, `name`, `quick_introduction`, `in_more_detail`, `why_this_is_important`, `when_to_use`, `how_can_you_spot_it`, `examples`, `real_world_implications`, `professional_application`, `how_can_this_be_misapplied`, `related_content`.

**Content**: `mental-models/*.yaml` — one file per language containing all models.

**Validation**:
```bash
node scripts/validate-yaml.mjs en
```

## Perspective Decks

- **Index**: `perspective-deck-index-schema.json` — lists decks with path, description, domain
- **Deck**: `perspective-deck-schema.json` — deck metadata + `cards` array
- **Card**: `perspective-card-schema.json` — id, name, prompt, optional follow_ups, domain

**Content**: `perspective-decks/*.yaml` — index and deck files together.
