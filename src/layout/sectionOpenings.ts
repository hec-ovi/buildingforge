import { sectionRoles, sectionSpans, spanField, isPaired, type FloorAssembly, type Section, type RoleField } from '../sections/index.ts';
import { buildingFamily, isFamilyArchitecture } from '../families/registry.ts';
import { ExteriorError } from '../core/errors.ts';
import type { BuildingRequest, Opening } from '../types.ts';
import type { FloorLayout } from './model.ts';
import { DOORS } from '../rules/tables.ts';
import { scenicState } from './scenicState.ts';
import { openingEnvelope } from './openingEnvelope.ts';

export interface SectionReservation { edge: number; start: number; end: number }

function fields(section: Section, height: number): RoleField[] {
  return section.windows?.map(field => ({ ...field, role: 'middle' as const }))
    ?? [sectionRoles(section, height).find(f => f.role === 'middle')!];
}

/** Authored windows fill clear section fields; supplied cuts retain their coordinates. */
export function sectionOpenings(request: BuildingRequest, plan: FloorAssembly, height: number, existing: Opening[], reservations: SectionReservation[] = []): Opening[] {
  const openings = existing;
  const family = buildingFamily(request.options?.architecture);
  const custom = isFamilyArchitecture(request.options?.architecture);
  const sharedRooms = custom || isPaired(request.options?.architecture);
  const reserved = (edge: number, start: number, end: number) => reservations.some(r => r.edge === edge && start < r.end - 1e-8 && end > r.start + 1e-8);
  for (const entrance of openings) {
    if (entrance.kind === 'aperture') continue;
    if (entrance.kind !== 'door' || entrance.doorRole !== 'main') throw new ExteriorError('E_SCHEMA', 'the selected architecture supports a single swing entrance');
    const choices = plan.sections.filter(s => s.edge === entrance.edge && ['deep-bay', 'ribbon-bay', 'paired-glass'].includes(s.technique) && !s.spans)
      .sort((a, b) => Math.abs(a.offset + a.width / 2 - entrance.offset - entrance.width / 2) - Math.abs(b.offset + b.width / 2 - entrance.offset - entrance.width / 2));
    const candidate = choices.map(section => {
      const field = sectionRoles(section, height).find(f => f.role === 'middle')!;
      const width = section.technique === 'paired-glass' ? Math.min(3, field.width) : field.width;
      const offset = section.offset + field.offset + (field.width - width) / 2;
      return { section, width, offset };
    }).find(({ width, offset }) => width >= 2 && !reserved(entrance.edge, offset, offset + width));
    if (!candidate) throw new ExteriorError('E_DOOR_FIT', 'the street entrance has no clear complete straight section');
    entrance.width = candidate.width;
    entrance.offset = candidate.offset;
    entrance.leaves = 2;
    entrance.door = { ...entrance.door!, motion: { kind: 'swing', maxTravel: 90, clearDepth: entrance.width / 2 } };
    entrance.sectionId = candidate.section.id;
  }
  for (const section of plan.sections) {
    if (['frame-pier', 'paired-solid', 'paired-pier', 'podium-panel'].includes(section.technique) && section.windows === undefined) continue;
    if (openings.some(o => o.kind === 'door' && o.sectionId === section.id)) continue;
    if (plan.floor === 0 && (sharedRooms && section.windows === undefined || request.options?.architecture === 'garden-taper')) continue;
    for (const [fieldIndex, whole] of fields(section, height).entries()) for (const [sectionSpan, span] of sectionSpans(section).entries()) {
      const middle = spanField(whole, span);
      if (!middle || reserved(span.edge, middle.offset, middle.offset + middle.width)) continue;
      const balcony = plan.balconySections.includes(section.id);
      const width = middle.width;
      const rule = DOORS.sets['glazed-grid'];
      const opening: Opening = {
        id: `${balcony ? 'bd' : 'w'}:${plan.floor}:${section.id}:${sectionSpan}${section.windows ? ':' + fieldIndex : ''}`, sectionId: section.id, sectionSpan,
        kind: balcony ? 'balconyDoor' : 'window', edge: span.edge,
        offset: middle.offset, width,
        sill: balcony ? 0 : middle.sill, height: balcony ? middle.sill + middle.height : middle.height,
        material: `${request.theme}/${balcony ? 'door-glass' : 'window-glass'}/${request.building.tier}`,
      };
      if (openings.some(other => {
        const field = openingEnvelope(other);
        return other.edge === opening.edge && field.offset < opening.offset + opening.width - 1e-8 && field.offset + field.width > opening.offset + 1e-8
          && field.sill < opening.sill + opening.height - 1e-8 && field.sill + field.height > opening.sill + 1e-8;
      })) continue;
      if (balcony) {
        opening.leaves = 2;
        opening.balcony = { width: section.width, depth: 1.5 };
        opening.door = { set: 'glazed-grid', frameWidth: rule.frameWidth, frameDepth: rule.frameDepth,
          recessDepth: section.border.depth, thresholdHeight: 0,
          motion: { kind: 'swing', maxTravel: 90, clearDepth: width / 2 } };
      } else {
        opening.panes = section.windows?.[fieldIndex]?.panes ?? section.panes
          ?? { cols: section.spans ? 1 : section.technique === 'paired-glass' ? Math.max(1, Math.min(4, Math.floor(width / 1.2)))
            : Math.max(1, Math.ceil(width / (request.options?.architecture === 'chamfered-corners' ? 4 : 1.5))), rows: 1 };
        if (sharedRooms) {
          opening.material = plan.floor === 0 ? `${request.theme}/window-glass-office/${request.building.tier}#clear` : family?.materials?.['window-glass'] ?? 'cyberpunk/paired-window-glass/mid#clear';
          if (plan.floor > 0 && scenicState(request.seed, plan.floor, section.id, section.technique === 'rounded-glass').state === 'dark') opening.material = family?.materials?.['window-black'] ?? 'cyberpunk/paired-window-black/mid#black';
          if (plan.floor === 0) opening.windowTreatment = { privacy: 'shell-only', nodeId: `ground-privacy:${opening.id}` };
        }
      }
      openings.push(opening);
    }
  }
  return openings;
}

/** Section fields contain every generated opening; infrastructure remains independent. */
export function checkSectionOpenings(floor: FloorLayout): void {
  const plan = floor.assembly;
  if (!plan) return;
  for (const opening of floor.openings) {
    if (opening.kind === 'aperture') continue;
    const section = plan.sections.find(s => s.id === opening.sectionId);
    if (!section) throw new ExteriorError('E_INVARIANT', `opening ${opening.id} has no section`);
    const source = opening.kind === 'door' ? [sectionRoles(section, floor.height).find(f => f.role === 'middle')!] : fields(section, floor.height);
    const span = sectionSpans(section)[opening.sectionSpan ?? 0]!;
    const valid = span && source.some(whole => {
      const field = spanField(whole, span);
      return field && opening.edge === span.edge && opening.offset >= field.offset - 1e-7
        && opening.offset + opening.width <= field.offset + field.width + 1e-7
        && (opening.kind !== 'window' || Math.abs(opening.sill - field.sill) < 1e-7 && Math.abs(opening.height - field.height) < 1e-7);
    });
    if (!valid) throw new ExteriorError('E_INVARIANT', `opening ${opening.id} changes its authored section field`);
  }
}
