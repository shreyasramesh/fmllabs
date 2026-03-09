# Mental Models & Cognitive Biases Schema

This directory contains the schema for mental models and cognitive biases content.

## Schema Files

| File | Purpose |
|------|---------|
| `mental-model-schema.json` | JSON Schema for a single mental model or cognitive bias entry |
| `mental-models-index-schema.json` | JSON Schema for the index (path + description per mental model) |

## Structure Overview

Each mental model or cognitive bias entry has the following sections:

| Section | Type | Description |
|---------|------|-------------|
| `id` | string | Unique identifier (snake_case) |
| `name` | string | Human-readable name |
| `quick_introduction` | string | Brief introduction to the topic |
| `in_more_detail` | string | Deeper explanation |
| `why_this_is_important` | string | Why understanding this matters |
| `when_to_use` | string[] | Tags: decision-making, investing, career_moves, risk_assessment, etc. |
| `how_can_you_spot_it` | object | Subsections with string values |
| `examples` | object | Example name → description mapping |
| `real_world_implications` | string or object | Impact in real-world contexts |
| `professional_application` | object | Subsections (e.g., networking_and_relationship_building) |
| `how_can_this_be_misapplied` | object | Subsections: manipulation, misinterpreting_relationships, overcommitment, etc. |
| `related_content` | string[] | List of related topic IDs |

## Validation

The YAML files include `yaml-language-server` schema directives for inline validation in editors that support it (e.g., VS Code with the YAML extension).

Validate from the command line using a tool like `ajv`:

```bash
# With ajv-cli (install: npm i -g ajv-cli)
ajv validate -s schema/mental-model-schema.json -d mental-models/loss-aversion-bias.yaml
ajv validate -s schema/mental-models-index-schema.json -d mental-models-index.yaml
```

## Content Organization

- **Index**: `mental-models-index.yaml` at project root lists all mental models with their path and quick introduction (description)
- **Per-topic files**: Individual files in `mental-models/` (e.g., `mental-models/loss-aversion-bias.yaml`) contain full content
