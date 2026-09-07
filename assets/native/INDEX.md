# Native exterior finishes

Built-in image generation supplies the fourteen albedo sources. Materials `from-image` derives the dry PBR maps, including packed metallic-roughness. Runtime generation uses the stored maps offline.

| Surface | Source | Prompt | Import |
| --- | --- | --- | --- |
| cast concrete | [PNG](sources/cast-concrete.png) | [prompt](prompts/cast-concrete.md) | [request](requests/cast-concrete.json) |
| weathered concrete | [PNG](sources/weathered-concrete.png) | [prompt](prompts/weathered-concrete.md) | [request](requests/weathered-concrete.json) |
| mineral concrete | [PNG](sources/mineral-concrete.png) | [prompt](prompts/mineral-concrete.md) | [request](requests/mineral-concrete.json) |
| graphite concrete | [PNG](sources/graphite-concrete.png) | [prompt](prompts/graphite-concrete.md) | [request](requests/graphite-concrete.json) |
| galvanized steel | [PNG](sources/galvanized-steel.png) | [prompt](prompts/galvanized-steel.md) | [request](requests/galvanized-steel.json) |
| graphite coating | [PNG](sources/graphite-coating.png) | [prompt](prompts/graphite-coating.md) | [request](requests/graphite-coating.json) |
| ac enamel | [PNG](sources/ac-enamel.png) | [prompt](prompts/ac-enamel.md) | [request](requests/ac-enamel.json) |
| ac coil | [PNG](sources/ac-coil.png) | [prompt](prompts/ac-coil.md) | [request](requests/ac-coil.json) |
| board concrete | [PNG](sources/board-concrete.png) | [prompt](prompts/board-concrete.md) | [request](requests/board-concrete.json) |
| aggregate concrete | [PNG](sources/aggregate-concrete.png) | [prompt](prompts/aggregate-concrete.md) | [request](requests/aggregate-concrete.json) |
| basalt concrete | [PNG](sources/basalt-concrete.png) | [prompt](prompts/basalt-concrete.md) | [request](requests/basalt-concrete.json) |
| brushed bronze | [PNG](sources/brushed-bronze.png) | [prompt](prompts/brushed-bronze.md) | [request](requests/brushed-bronze.json) |
| brushed steel | [PNG](sources/brushed-steel.png) | [prompt](prompts/brushed-steel.md) | [request](requests/brushed-steel.json) |
| chalk coating | [PNG](sources/chalk-coating.png) | [prompt](prompts/chalk-coating.md) | [request](requests/chalk-coating.json) |

[Bindings](bindings.json) select one of two palettes per exterior style using the building seed. Six shared palettes provide eighteen style combinations: slate, formed concrete, warm aggregate, pale coating, bronze and steel. All faces share that selection. [Catalog](../../public/native-materials/themes/cyberpunk/theme.json) publishes every variant and map path. Concrete uses a 2 m repeat; coatings and metals use 0.75 m; enamel uses 1 m. Radiator imagery clamps to the front face. Panel divisions and condenser fans are geometry.

Run imports from the Exterior checkout, with the Materials checkout beside it:

```sh
../materials/node_modules/.bin/tsx ../materials/src/cli/pbrforge.ts doctor --themes public/native-materials/themes
../materials/node_modules/.bin/tsx ../materials/src/cli/pbrforge.ts from-image assets/native/requests/cast-concrete.json --themes public/native-materials/themes
../materials/node_modules/.bin/tsx ../materials/src/cli/pbrforge.ts resolve cyberpunk/exterior-cast-concrete/mid --themes public/native-materials/themes
```

Read Materials' `skills/pbrforge/references/from-image.md` before importing. Existing keys require an explicit overwrite. The CLI writes the catalog and maps; edits belong in source prompts and request JSON. Brightness-derived relief is deliberately shallow because material color is not a measured height field.

[glTF packed material semantics](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#metallic-roughness-material): G is roughness, B is metalness; map-bound factors are 1.
