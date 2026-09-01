# Changelog

- 0.6: floor solver searches legal splits between aperture bases (bounded count allocation, feasible range named in E_APERTURE_UNREACHABLE); envelope scaling rounds down so quantization cannot overflow maxHeight; feasibility constants published at schemas/floor-constants.json (type map, min/max floor height, min footprint area) for assemblers.
- 0.5: GLB output mode option: named (canonical, node per part) or merged (one mesh per material key for runtime scale), identical blueprint in both.
- 0.4: generator implemented end to end: split-grammar facades, aperture carving with floor elevations pinned to each base, balconies, signage, lights, fire escapes, roof artifacts, curtain states, GLB shell with named nodes and theme/kind/tier materials, blueprint JSON, orbit preview with clip and highlight inspection, contract test suite.
- 0.3: contract with request and blueprint schemas (atlas types and tiers verbatim, connections aperture constraints, interior floors core); research conclusions in docs/RESEARCH.md drive the rules.
