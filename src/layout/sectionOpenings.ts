import { sectionRoles, sectionSpans, spanField, type FloorAssembly } from '../sections/index.ts';
import { ExteriorError } from '../core/errors.ts';
import type { BuildingRequest, Opening } from '../types.ts';
import type { FloorLayout } from './model.ts';
import { DOORS } from '../rules/tables.ts';

/** Entrance and vision openings occupy exact fields of the authored assembly. */
export function sectionOpenings(request: BuildingRequest, plan: FloorAssembly, height: number, existing: Opening[]): Opening[] {
  const openings = existing;
  for (const entrance of openings) {
    if (entrance.kind !== 'door' || entrance.doorRole !== 'main') throw new ExteriorError('E_SCHEMA', 'the selected architecture supports a single swing entrance');
    const choices = plan.sections.filter(s => s.edge === entrance.edge && (s.technique === 'deep-bay' || s.technique === 'ribbon-bay'))
      .sort((a, b) => Math.abs(a.offset + a.width / 2 - entrance.offset - entrance.width / 2) - Math.abs(b.offset + b.width / 2 - entrance.offset - entrance.width / 2));
    const section = choices[0];
    if (!section) throw new ExteriorError('E_DOOR_FIT', 'the street entrance has no complete straight section');
    entrance.width = section.width - 2 * section.border.side;
    entrance.offset = section.offset + section.border.side;
    entrance.leaves = 2;
    entrance.door = { ...entrance.door!, motion: { kind: 'swing', maxTravel: 90, clearDepth: entrance.width / 2 } };
    entrance.sectionId = section.id;
  }
  for (const section of plan.sections) {
    if (section.technique === 'frame-pier') continue;
    if (openings.some(o => o.sectionId === section.id)) continue;
    const whole = sectionRoles(section, height).find(f => f.role === 'middle')!;
    for (const [sectionSpan, span] of sectionSpans(section).entries()) {
      const middle = spanField(whole, span);
      if (!middle) continue;
      const balcony = plan.balconySections.includes(section.id);
      const width = middle.width;
      const rule = DOORS.sets['glazed-grid'];
      const opening: Opening = {
        id: `${balcony ? 'bd' : 'w'}:${plan.floor}:${section.id}:${sectionSpan}`, sectionId: section.id, sectionSpan,
        kind: balcony ? 'balconyDoor' : 'window', edge: span.edge,
        offset: middle.offset, width,
        sill: balcony ? 0 : middle.sill, height: balcony ? middle.sill + middle.height : middle.height,
        material: `${request.theme}/${balcony ? 'door-glass' : 'window-glass'}/${request.building.tier}`,
      };
      if (balcony) {
        opening.leaves = 2;
        opening.balcony = { width: section.width, depth: 1.5 };
        opening.door = { set: 'glazed-grid', frameWidth: rule.frameWidth, frameDepth: rule.frameDepth,
          recessDepth: section.border.depth, thresholdHeight: 0,
          motion: { kind: 'swing', maxTravel: 90, clearDepth: width / 2 } };
      } else {
        opening.panes = { cols: Math.max(1, Math.ceil(width / 1.5)), rows: 1 };
      }
      openings.push(opening);
    }
  }
  return openings;
}

/** Validates section openings against their catalog fields after all root planning. */
export function checkSectionOpenings(floor: FloorLayout): void {
  const plan = floor.assembly;
  if (!plan) return;
  for (const opening of floor.openings) {
    const section = plan.sections.find(s => s.id === opening.sectionId);
    if (!section) throw new ExteriorError('E_INVARIANT', `opening ${opening.id} has no section`);
    const whole = sectionRoles(section, floor.height).find(f => f.role === 'middle')!;
    const span = sectionSpans(section)[opening.sectionSpan ?? 0]!;
    const field = spanField(whole, span)!;
    const valid = opening.edge === span.edge && Math.abs(opening.offset - field.offset) < 1e-7
      && Math.abs(opening.width - field.width) < 1e-7
      && (opening.kind !== 'window' || Math.abs(opening.sill - field.sill) < 1e-7 && Math.abs(opening.height - field.height) < 1e-7);
    if (!valid) throw new ExteriorError('E_INVARIANT', `opening ${opening.id} changes its authored section field`);
  }
}
