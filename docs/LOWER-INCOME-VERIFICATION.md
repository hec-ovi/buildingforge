# Lower-income family verification

The six new full-building families follow the selected residential, factory-tower and storage references. Their plans add geometry and opening systems; the accepted premium families and their piece-kit recipes remain intact.

Canonical requests are in `fixtures/<family>.request.json`: 48 × 36 m parcels, `poor` tier, residential or factory programme, 8 floors except the 2-floor storage building. The floor stack retains the shared 4.5 m pitch. Generated source proofs are in `/home/hec/workspace/urbe/outputs/low-tier-exteriors/`, one named GLB and blueprint per family plus `proof-summary.json`. Rendering and paired game verification are coordinated by the root Engine workflow.

| Family | Triangles | Published allowance | Defining geometry |
| --- | ---: | ---: | --- |
| residential-courtyard | 63,648 | 73,055 | Worn concrete bays, shutters, grilles, supported canopies, fitted fabric and connected stairs |
| residential-serviced | 69,046 | 74,806 | Rounded corner, floor spandrels, supported condensers, risers and connected cable |
| residential-megablock | 76,290 | 76,752 | Long grouped residential slab, repeated window pairs and stepped upper groups |
| industrial-framed | 66,826 | 74,880 | Multi-floor supporting frame, projecting bands, braces and recessed glazing |
| industrial-solid | 71,312 | 74,880 | Solid stacked sections, angular supports and aligned narrow glazing |
| service-storage | 15,342 | 50,000 | Broad sealed shutter bays and separate usable entrance |

The courtyard keeps its 4 m circulation reserve outside its floor outline. Eight actual service doors connect eight floor landings; seven switchback flights reach them. Each flight has two half-flights with 12 risers, 0.1875 m rise, 0.28 m going, and 1.2 m clear tread width. Stair and floor-door coordinates are published under `fireEscape.connected`; the lowest landing has a street approach, upper landings retain guards, and the geometry tests check at least 2.2 m route clearance.

Verification includes full generator exports at 32 × 24, 40 × 32 and 48 × 36 m, 3 and 8 floors for residential/industrial forms, and 1/2/3 floors for storage: 39/39 cases passed. Ten additional courtyard/megablock seed variations passed. The closest courtyard seed was then improved to 58,796 / 61,823 triangles by thinning repeated canopies at the last detail step while preserving its defining geometry and stair route. The material budget was not increased.

Targeted checks:

- All new family module tests, full generator host tests and stair geometry tests pass.
- Accepted family host and automatic-selection regressions pass.
- TypeScript and whitespace validation pass.
- Engine's exact rotated balcony-grid stair/roof regression passes after keeping the new millimetre door fitting limited to the six new families.

New residential forms are eligible for poor/mid residential or hotel programmes. Industrial towers require at least three floors; storage is available through three floors for factory and commerce programmes. Fixed faces retain complete openings; automatic selection excludes courtyard stairs where a parcel cannot reserve their setback. Whole generated plans carry these forms into Engine; the existing six piece sets are unchanged.
