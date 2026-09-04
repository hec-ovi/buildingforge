// Exact facade grids published for the interior: the map repeat, panel seams,
// opening-free wall runs and the wall width available at each partition anchor.

import { ExteriorError } from '../core/errors.ts';
import { edgeLength } from '../core/polygon.ts';
import { fixedPanelAxis } from './module.ts';
import type { Blueprint, Floor } from '../types.ts';

const PARTITION_THICKNESS = 0.12;
const PARTITION_EDGE_CLEARANCE = 0.02;
const MIN_PARTITION_SEAT = PARTITION_THICKNESS + 2 * PARTITION_EDGE_CLEARANCE;

export function buildFacadeGrids(
  floors: readonly Floor[], panelWidth: number, panelHeight: number,
): Blueprint['facade']['grids'] {
  const grids: Blueprint['facade']['grids'] = [];
  for (const floor of floors) {
    for (let edge = 0; edge < floor.outline.length; edge++) {
      const length = edgeLength(floor.outline, edge);
      const horizontalAxis = fixedPanelAxis(length, panelWidth);
      const verticalAxis = fixedPanelAxis(floor.height, panelHeight);
      const occupied = merge(floor.openings
        .filter((opening) => opening.edge === edge)
        .map((opening): [number, number] => [opening.offset, opening.offset + opening.width]));
      const solid = complement(length, occupied);
      const partitionAnchors = solid
        .filter(([start, end]) => end - start >= MIN_PARTITION_SEAT - 1e-9)
        .map(([start, end]) => ({
          offset: (start + end) / 2,
          width: mm(end - start),
        }));
      grids.push({
        floor: floor.index,
        edge,
        length: mm(length),
        panelWidth: mm(panelWidth),
        panelHeight: mm(panelHeight),
        horizontal: horizontalAxis.boundaries,
        vertical: verticalAxis.boundaries,
        horizontalBorders: horizontalAxis.borders,
        verticalBorders: verticalAxis.borders,
        solid,
        partitionAnchors,
      });
    }
  }
  checkFacadeGrids(floors, grids);
  return grids;
}

function merge(input: [number, number][]): [number, number][] {
  const sorted = [...input].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (!last || start > last[1] + 1e-9) out.push([mm(start), mm(end)]);
    else last[1] = mm(Math.max(last[1], end));
  }
  return out;
}

function complement(length: number, occupied: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let cursor = 0;
  for (const [start, end] of occupied) {
    if (start > cursor + 1e-9) out.push([mm(cursor), mm(start)]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < length - 1e-9) out.push([mm(cursor), mm(length)]);
  return out;
}

function checkFacadeGrids(
  floors: readonly Floor[], grids: Blueprint['facade']['grids'],
): void {
  const byFloor = new Map(floors.map((floor) => [floor.index, floor]));
  for (const grid of grids) {
    const floor = byFloor.get(grid.floor)!;
    const fail = (message: string): never => {
      throw new ExteriorError('E_INVARIANT',
        `facade grid floor ${grid.floor} edge ${grid.edge} ${message}; exterior bug, report with the request`);
    };
    if (grid.horizontal[0] !== 0 || Math.abs(grid.horizontal.at(-1)! - grid.length) > 0.001) {
      fail('does not close on the edge');
    }
    if (grid.vertical[0] !== 0 || Math.abs(grid.vertical.at(-1)! - floor.height) > 0.001) {
      fail('does not close on the storey');
    }
    const [left, right] = grid.horizontalBorders;
    const [bottom, top] = grid.verticalBorders;
    if (Math.abs(left - right) > 0.001 || Math.abs(bottom - top) > 0.001
      || left < -1e-9 || left >= grid.panelWidth / 2 + 0.001
      || bottom < -1e-9 || bottom >= grid.panelHeight / 2 + 0.001) {
      fail('has invalid centred solid borders');
    }
    const fieldWidth = grid.length - left - right;
    const fieldHeight = floor.height - bottom - top;
    if (Math.abs(fieldWidth / grid.panelWidth - Math.round(fieldWidth / grid.panelWidth)) > 0.001
      || Math.abs(fieldHeight / grid.panelHeight - Math.round(fieldHeight / grid.panelHeight)) > 0.001) {
      fail(`changes the fixed panel scale instead of fitting complete panels (${JSON.stringify({
        length: grid.length, height: floor.height, panelWidth: grid.panelWidth,
        panelHeight: grid.panelHeight, horizontalBorders: grid.horizontalBorders,
        verticalBorders: grid.verticalBorders, fieldWidth, fieldHeight,
      })})`);
    }
    const openings = floor.openings.filter((opening) => opening.edge === grid.edge);
    for (const [start, end] of grid.solid) {
      if (start < -1e-9 || end > grid.length + 1e-9 || start >= end) fail('has an invalid solid run');
      if (openings.some((opening) => start < opening.offset + opening.width - 0.0011
        && end > opening.offset + 0.0011)) fail('marks an opening as solid');
    }
    for (const anchor of grid.partitionAnchors) {
      if (anchor.width < MIN_PARTITION_SEAT - 1e-9
        || !grid.solid.some(([start, end]) => anchor.offset >= start && anchor.offset <= end
          && anchor.width <= end - start + 0.001)) fail('has an invalid partition anchor');
    }
  }
}

function mm(value: number): number {
  return Math.round(value * 1000) / 1000;
}
