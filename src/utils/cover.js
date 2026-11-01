import * as THREE from 'three';

// Cover queries: which tall world solids stand in a round's way.
// `boxes` is LevelManager.blockers — building/lot footprints only, so short
// street furniture never shields an enemy.

const _hit = new THREE.Vector3();

/** Distance along `ray` to the nearest cover solid, or Infinity if it is clear. */
export function nearestCover(ray, boxes) {
  if (!boxes || !boxes.length) return Infinity;
  let best = Infinity;
  for (const b of boxes) {
    if (!ray.intersectBox(b, _hit)) continue;
    const d = ray.origin.distanceTo(_hit);
    if (d < best) best = d;
  }
  return best;
}

/** True when cover is closer to the origin than `targetDistance`. */
export function coverBlocks(ray, boxes, targetDistance) {
  return nearestCover(ray, boxes) < targetDistance;
}
