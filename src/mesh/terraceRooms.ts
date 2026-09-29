import type { RoofBay } from '../layout/roofTerrace.ts';
import { TERRACE as F, TerraceKit } from './terraceKit.ts';
import { terraceFern, smoothTube } from './terraceFoliage.ts';

const DECK = .08;

/** Bar court: layered canopy, real backbar and a separate salon.
 * All geometry fits the bay reservations; front aprons remain open circulation. */
export function terraceBar(t: TerraceKit, bay: RoofBay): void {
  const { u, v, width: w, depth: d } = bay;
  deck(t, bay); canopy(t, bay, 'bar');
  screen(t, u + w / 2, v + d - .55, w - 1.2, 2.45);
  const counterU = u + w / 2 + .35, counterV = v + d - 2.25, length = w - 2.4;
  // Recessed plinth, separate fluted doors, slab overhang and a brass foot rail.
  t.box(F.metal, counterU, DECK, counterV, length - .22, .16, .62);
  t.bevel(F.stone, counterU, .22, counterV, length - .08, .76, .76, .02);
  const leaves = Math.round(length / .78), pitch = length / leaves;
  for (let i = 0; i < leaves; i++) {
    const x = counterU - length / 2 + (i + .5) * pitch;
    t.bevel(F.darkWood, x, .24, counterV - .407, pitch - .022, .72, .065, .009);
    for (let rib = 0; rib < 7; rib++) t.box(F.wood, x - pitch * .4 + rib * pitch * .8 / 6, .27, counterV - .45, .024, .63, .025);
    t.rod(F.bronze, [x - .11, .85, counterV - .478], [x + .11, .85, counterV - .478], .012);
  }
  t.bevel(F.topStone, counterU, .99, counterV - .08, length + .3, .095, 1.08, .027);
  t.box(F.bronze, counterU, .955, counterV - .62, length + .22, .025, .027);
  t.rod(F.bronze, [counterU - length / 2 + .12, .27, counterV - .84], [counterU + length / 2 - .12, .27, counterV - .84], .025);
  for (const x of [counterU - length / 2 + .25, counterU, counterU + length / 2 - .25]) {
    t.rod(F.metal, [x, .27, counterV - .84], [x, .27, counterV - .43], .023);
  }
  // The back counter keeps a 1.1m working aisle behind the main counter.
  const backV = v + d - .85;
  t.box(F.metal, counterU, DECK, backV, length - .1, .12, .45);
  t.bevel(F.darkWood, counterU, .2, backV, length - .1, .69, .48, .014);
  t.bevel(F.topStone, counterU, .90, backV, length + .02, .065, .58, .018);
  for (const y of [1.38, 1.95]) {
    t.box(F.wood, counterU, y, backV + .05, length - .18, .055, .34);
    for (const x of [counterU - 1.8, counterU, counterU + 1.8]) t.rod(F.bronze, [x, y - .2, backV + .2], [x, y, backV -.10], .014);
  }
  for (let i = 0; i < 8; i++) bottle(t, counterU - length / 2 + .45 + i * .57, 1.435, backV, i % 3);
  // A plumbed sink with a raised tap, recessed dark bowl and a real shelf edge.
  t.bevel(F.metal, counterU - 1.35, .968, backV, .7, .025, .43, .02);
  t.bevel(F.darkWood, counterU - 1.35, .994, backV, .54, .018, .3, .035);
  t.rod(F.bronze, [counterU - 1.35, .98, backV + .16], [counterU - 1.35, 1.24, backV + .16], .018);
  t.rod(F.bronze, [counterU - 1.35, 1.24, backV + .16], [counterU - 1.35, 1.24, backV -.02], .018);
  for (const offset of [-1.7, 0, 1.7]) stool(t, counterU + offset, counterV - 1.2);
  tray(t, counterU + 1.4, 1.09, counterV - .08);
  planter(t, u + .65, v + d / 2, .8, d - 1.9, true);
  t.lamp(counterU - 1.7, 2.35, v + d - .58, 0, -1, 500, 7);
  t.lamp(counterU + 1.7, 2.35, v + d - .58, 0, -1, 500, 7);
}

export function terraceSalon(t: TerraceKit, bay: RoofBay): void {
  const { u, v, width: w, depth: d } = bay;
  deck(t, bay); canopy(t, bay, 'salon');
  screen(t, u + w / 2, v + d - .55, w - 1.2, 2.15);
  const seats = 3, seatWidth = 1.08, sofaU = u + 2.5, sofaV = v + d - 1.65;
  for (let i = 0; i < seats; i++) sofaSeat(t, sofaU - seatWidth + i * seatWidth, sofaV, seatWidth);
  // Independent deep lounge chairs face the sofa across a low stone table.
  armchair(t, sofaU - 1.0, v + 2.5, Math.PI);
  armchair(t, sofaU + .8, v + 2.5, Math.PI);
  t.bevel(F.metal, sofaU, DECK, v + 3.95, 1.1, .30, .7, .025);
  t.bevel(F.topStone, sofaU, .38, v + 3.95, 1.8, .09, 1.03, .035);
  tray(t, sofaU + .25, .476, v + 3.95);
  // A separate two-person dining/reading pocket, not another copy of the bar.
  const tableU = u + w - 1.8, tableV = v + 2.25;
  t.cylinder(F.metal, tableU, DECK, tableV, .26, .65);
  t.cylinder(F.bronze, tableU, .73, tableV, .64, .03);
  t.cylinder(F.topStone, tableU, .76, tableV, .62, .055);
  diningChair(t, tableU, tableV - 1.04, 0);
  diningChair(t, tableU, tableV + 1.04, Math.PI);
  tray(t, tableU + .1, .82, tableV);
  planter(t, u + w - .62, v + d - 1.65, .75, 2.1, true);
  planter(t, u + 1.0, v + d - .7, .9, .7);
  t.lamp(u + 2.0, 1.95, v + d - .58, 0, -1, 450, 7);
  t.lamp(u + w - 1.55, 1.95, v + d - .58, 0, -1, 450, 7);
}

export function terraceGarden(t: TerraceKit, bay: RoofBay): void {
  const { u, v, width: w, depth: d } = bay;
  deck(t, bay);
  planter(t, u + w / 2, v + d - .55, w - .65, .85);
  for (const x of [u + 1.8, u + w - 1.8]) {
    for (const sx of [-.4, .4]) {
      t.beam(F.metal, [x + sx, .25, v + .65], [x + sx, .25, v + 2.9], .055, .075);
      for (const z of [v + .8, v + 2.75]) t.box(F.metal, x + sx, DECK, z, .06, .20, .12);
      t.beam(F.wood, [x + sx, .34, v + 1.9], [x + sx, .91, v + 2.9], .065, .09);
    }
    for (let i = 0; i < 10; i++) t.box(F.wood, x, .3, v + .62 + i * .13, .92, .055, .115);
    for (let i = 0; i < 8; i++) t.beam(F.wood, [x - .46, .35 + i * .074, v + 1.95 + i * .127], [x + .46, .35 + i * .074, v + 1.95 + i * .127], .11, .055);
    t.bevel(F.fabric, x, .355, v + 1.15, .78, .065, 1.04, .025);
    t.bevel(F.fabric, x, .67, v + 2.65, .66, .16, .34, .06);
    const tableX = x + (x < u + w / 2 ? 1.1 : -1.1);
    t.cylinder(F.metal, tableX, DECK, v + 1.5, .15, .4);
    t.cylinder(F.topStone, tableX, .48, v + 1.5, .34, .05);
    bottle(t, tableX, .54, v + 1.5, 0);
    t.box(F.metal, x, DECK, v + d - 1.08, .10, 1.45, .10);
    t.lamp(x, 1.48, v + d - 1.08, 0, -1, 550, 8);
  }
}

export function deck(t: TerraceKit, bay: RoofBay): void {
  const { u, v, width: w, depth: d } = bay;
  // The mineral backing carries the body; timber is only 6mm above its support.
  t.bevel(F.stone, u + w / 2, 0, v + d / 2, w, .068, d, .012);
  const count = Math.floor((w - .42) / .18), pitch = (w - .42) / count;
  for (let i = 0; i < count; i++) {
    const x = u + .21 + (i + .5) * pitch;
    const start = (i % 3) * .67;
    const cuts = [0, start, start + 2.0, start + 4.0, start + 6.0, d - .42].filter(x => x >= 0 && x <= d - .42).sort((a, b) => a - b);
    const left = x - (pitch-.008)/2, right = x + (pitch-.008)/2, near = v+.21, far = v+d-.21;
    // Long reveals share vertices across butt joints; only the top is segmented.
    for (const side of [-1,1]) {
      const edge = side < 0 ? left : right;
      t.sink.quadFacing(F.wood, t.point(edge,.068,near), t.point(edge,.068,far), t.point(edge,.08,far), t.point(edge,.08,near),
        [side*t.plan.axis[0],0,side*t.plan.axis[1]], [[0,0],[d-.42,0],[d-.42,.012],[0,.012]]);
    }
    for (const z of [near,far]) t.sink.quadFacing(F.wood, t.point(left,.068,z), t.point(right,.068,z), t.point(right,.08,z), t.point(left,.08,z),
      z === near ? [t.plan.axis[1],0,-t.plan.axis[0]] : [-t.plan.axis[1],0,t.plan.axis[0]], [[0,0],[pitch,0],[pitch,.012],[0,.012]]);
    for (let j = 1; j < cuts.length; j++) {
      const lo = cuts[j - 1]!, hi = cuts[j]!;
      if (hi - lo < .05) continue;
      t.sink.quadFacing(F.wood, t.point(left,.08,near+lo+.0035), t.point(right,.08,near+lo+.0035),
        t.point(right,.08,near+hi-.0035), t.point(left,.08,near+hi-.0035), [0,1,0], [[0,lo],[pitch,lo],[pitch,hi],[0,hi]]);
    }
  }
  for (const x of [u + .115, u + w - .115]) t.box(F.darkWood, x, .068, v + d / 2, .20, .012, d - .04);
  for (const z of [v + .115, v + d - .115]) t.box(F.darkWood, u + w / 2, .068, z, w - .42, .012, .20);
}

function canopy(t: TerraceKit, bay: RoofBay, kind: 'bar' | 'salon'): void {
  const { u, v, width: w, depth: d } = bay;
  for (const x of [u + .34, u + w - .34]) for (const z of [v + .34, v + d - .34]) {
    t.box(F.metal, x, DECK, z, .175, 2.96, .175);
    t.bevel(F.frame, x, .10, z, .19, 2.92, .19, .012);
    t.bevel(F.bronze, x, .08, z, .25, .13, .25, .014);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.cylinder(F.metal, x + sx * .095, .213, z + sz * .095, .015, .012, 6);
    t.lamp(x, 2.58, z, x < u + w / 2 ? 1 : -1, 0, kind === 'bar' ? 800 : 650, 10);
  }
  for (const x of [u + .34, u + w - .34]) t.bevel(F.frame, x, 2.86, v + d / 2, .24, .3, d - .08, .012);
  for (const z of [v + .34, v + d - .34]) t.bevel(F.frame, u + w / 2, 2.95, z, w - .08, .25, .24, .012);
  for (let z = v + .55; z < v + d - .3; z += .72) t.bevel(F.wood, u + w / 2, 3.13, z, w - .12, .17, .10, .007);
  // Dense slat fields deliberately surround one open sky slot. Their grain and
  // joints differ from the heavier crossmembers carrying them.
  for (let x = u + .48; x < u + w - .45; x += .19) for (const [near, far] of [[v + .45, v + 2.15], [v + 3.65, v + d - .45]]) {
    t.box(F.wood, x, 3.28, (near! + far!) / 2, .17, .055, far! - near!);
  }
}

function screen(t: TerraceKit, u: number, v: number, width: number, height: number): void {
  for (const x of [u - width / 2, u + width / 2]) t.box(F.metal, x, DECK, v, .07, height, .08);
  for (const y of [.23, height - .12]) t.box(F.metal, u, y, v + .045, width, .055, .055);
  const count = Math.floor(width / .12), pitch = width / count;
  for (let i = 0; i < count; i++) {
    const x = u - width / 2 + (i + .5) * pitch;
    if (i === 0 || i === count - 1) t.bevel(F.wood, x, DECK, v, pitch - .045, height, .065, .006);
    else t.box(F.wood, x, DECK, v, pitch - .045, height, .065);
  }
}

export function planter(t: TerraceKit, u: number, v: number, w: number, d: number, tall = false): void {
  t.bevel(F.stone, u, DECK, v, w, .14, d, .025);
  for (const z of [v - d / 2 + .055, v + d / 2 - .055]) t.bevel(F.stone, u, .2, z, w, .58, .11, .012);
  for (const x of [u - w / 2 + .055, u + w / 2 - .055]) t.bevel(F.stone, x, .2, v, .11, .58, d - .2, .012);
  t.box(F.soil, u, .69, v, w - .22, .035, d - .22);
  const alongU = w >= d, length = alongU ? w : d, count = Math.max(1, Math.max(1, Math.floor(length / 1.25)));
  for (let i = 0; i < count; i++) {
    const shift = (i + .5) * length / count - length / 2;
    terraceFern(t, u + (alongU ? shift : 0), v + (alongU ? 0 : shift),
      Math.min(w + .30, 1.45), Math.min(d + .30, 1.45), tall ? 1.10 + i % 3 * .17 : .80 + i % 3 * .12, `${u}:${v}:${i}`);
  }
}

function stool(t: TerraceKit, u: number, v: number): void {
  // A light wire stool: two bent hairpin sleds carry a small woven seat.
  // No pedestal or solid wedge fills the space under the stool.
  for (const side of [-1, 1]) {
    const x = u + side * .205;
    const path: [number, number, number][] = [
      [x,.73,v-.18],[x+side*.018,.66,v-.205],[x+side*.047,.17,v-.235],
      [x+side*.045,.10,v-.205],[x+side*.035,.0865,v-.14],
      [x+side*.035,.0865,v+.14],[x+side*.045,.10,v+.205],
      [x+side*.047,.17,v+.235],[x+side*.018,.66,v+.205],[x,.73,v+.18],
    ];
    smoothTube(t, F.wire, path, .0065, .0065, 8);
  }
  for (const z of [v-.18,v+.18]) smoothTube(t, F.wire, [[u-.205,.68,z],[u+.205,.68,z]], .0055);
  smoothTube(t, F.wire, [[u-.24,.31,v-.23],[u-.20,.29,v-.265],[u+.20,.29,v-.265],[u+.24,.31,v-.23]], .0055);
  // A closed slim seat rim and a shallow woven pad, both supported by the wire.
  const rim = Array.from({length:33},(_,i):[number,number,number] => [u+Math.cos(i*Math.PI/16)*.267,.743,v+Math.sin(i*Math.PI/16)*.267]);
  smoothTube(t, F.wire, rim, .0085, .0085, 8);
  t.lathe('cyberpunk/meridian-upholstery/rich#charcoal', u, .735, v, [[0,.235],[.009,.255],[.025,.255],[.035,.225]], 32);
  // The 20mm steel pan retains actual shell collision behind the woven surface.
  t.cylinder(F.metal, u, .716, v, .247, .02, 24);
}

function sofaSeat(t: TerraceKit, u: number, v: number, width: number): void {
  t.bevel(F.metal, u, DECK, v, width - .06, .44, .87, .025);
  t.bevel(F.darkWood, u, .11, v, width - .04, .21, .89, .014);
  t.bevel(F.fabric, u, .43, v, width - .018, .14, .87, .045);
  t.bevel(F.metal, u, .44, v + .39, width - .04, .46, .16, .025);
  t.bevel(F.fabric, u, .52, v + .34, width - .018, .42, .22, .055);
  t.box(F.darkWood, u, .44, v + .478, width - .07, .44, .02);
  t.pillow(F.darkFabric, u + .2, .58, v + .08, .48, .25, .32);
}

function armchair(t: TerraceKit, u: number, v: number, yaw: number): void {
  // Furniture uses a local frame, so the seat and support turn as one assembly.
  const local = Object.create(t) as TerraceKit;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  local.point = (x, y, z) => t.point(u + x * c + z * s, y, v - x * s + z * c);
  // Only half-turns are needed here; symmetric boxes retain their axes.
  sofaSeat(local, 0, 0, 1.02);
  for (const x of [-.5, .5]) {
    local.bevel(F.metal, x, .24, 0, .12, .47, .9, .025);
    local.bevel(F.fabric, x, .46, -.02, .16, .29, .90, .045);
  }
}

function diningChair(t: TerraceKit, u: number, v: number, yaw: number): void {
  const face = Math.cos(yaw), back = v - face * .29;
  for (const x of [u - .26, u + .26]) for (const z of [v - .26, v + .26]) t.rod(F.metal, [x, DECK, z], [x, .49, z], .023);
  t.bevel(F.metal, u, .43, v, .57, .08, .57, .022);
  t.bevel(F.fabric, u, .45, v, .61, .08, .59, .03);
  for (const x of [u - .25, u + .25]) t.rod(F.metal, [x, .48, back], [x, 1.04, back], .021);
  t.bevel(F.wood, u, .73, back, .61, .33, .065, .045);
}

function bottle(t: TerraceKit, u: number, y: number, v: number, variant: number): void {
  const height = .23 + variant * .035;
  t.lathe(F.glass, u, y, v, [[0, .043], [.012, .05], [height * .6, .05], [height * .77, .022], [height, .018]], 14);
  t.cylinder(F.bronze, u, y + height, v, .020, .025, 14);
}
function tray(t: TerraceKit, u: number, y: number, v: number): void {
  t.bevel(F.darkWood, u, y, v, .42, .025, .31, .012);
  bottle(t, u - .09, y + .028, v, 0);
  t.lathe(F.stone, u + .10, y + .029, v + .01, [[0, .038], [.10, .045], [.11, .042], [.018, .032]], 16);
}
