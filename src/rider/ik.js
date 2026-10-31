function ik2(a, c, l1, l2, hint) {
  const d = Math.min(a.distanceTo(c), l1 + l2 - 0.002),
    dir = c.clone().sub(a).normalize(),
    al = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, l1 * l1 - al * al));
  const pp = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
  return a.clone().addScaledVector(dir, al).addScaledVector(pp, h);
}

export { ik2 };
