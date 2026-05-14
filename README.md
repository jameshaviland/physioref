# PhysioRef

Fully offline macOS desktop clinical reference for physiotherapy students. 113 pathologies across MSK, CVR, and Neuro — with named special tests, validated outcome measures, NICE guidelines, and phased management plans.

## Requirements

- macOS 11+
- Node.js 18+ (for building only)

## Run in development

```bash
cd PhysioRef
npm install
npm start
```

## Build distributable .dmg

```bash
npm run build
```

The output `.dmg` will appear in the `dist/` folder. Open it, drag PhysioRef to Applications, and double-click to launch — no internet connection needed.

## Content

| Category | Subcategories | Conditions |
|----------|--------------|------------|
| MSK | Shoulder, Elbow, Wrist, Cervical, Lumbar, Hip, Knee, Foot/Ankle, Inflammatory | 66 |
| CVR | Cardiac, Respiratory, Vascular | 23 |
| NEURO | CNS, PNS, Vestibular, Neuromuscular | 24 |

**Total: 113 pathologies**
