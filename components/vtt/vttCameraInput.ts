/** Preserve all normal OrbitControls mouse gestures except left-button
 * orbiting while a GM is moving a selected miniature/formation.
 * -1 is the OrbitControls unhandled mouse action sentinel.
 */
export function orbitMouseButtons(lockLeft: boolean): {LEFT: number} {
  return { LEFT: lockLeft ? -1 : 0 }; // THREE.MOUSE.ROTATE is 0
}
