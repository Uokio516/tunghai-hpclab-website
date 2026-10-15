export type Direction = "left" | "right" | "up" | "down";
export type Round = { cells: number[]; score: number; moves: number };

export function slide(cells: number[], direction: Direction) {
  const next = [...cells];
  let gained = 0;
  const merged: number[] = [];
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, position) => {
      const p = direction === "right" || direction === "down" ? 3 - position : position;
      return direction === "left" || direction === "right" ? line * 4 + p : p * 4 + line;
    });
    const values = indices.map(i => cells[i]).filter(Boolean);
    const output: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        const value = values[i] * 2;
        merged.push(indices[output.length]);
        output.push(value); gained += value; i++;
      } else output.push(values[i]);
    }
    indices.forEach((index, i) => { next[index] = output[i] || 0; });
  }
  return { cells: next, gained, merged, changed: next.some((value, i) => value !== cells[i]) };
}

export function spawn(cells: number[], random = Math.random) {
  const empty = cells.map((value, i) => value ? -1 : i).filter(i => i !== -1);
  if (!empty.length) return { cells: [...cells], index: -1 };
  const index = empty[Math.floor(random() * empty.length)];
  const next = [...cells]; next[index] = random() < .9 ? 2 : 4;
  return { cells: next, index };
}

export function newRound(): Round {
  return { cells: spawn(spawn(Array(16).fill(0)).cells).cells, score: 0, moves: 0 };
}

export function canMove(cells: number[]) {
  return cells.some((value, i) => !value || (i % 4 < 3 && value === cells[i + 1]) || (i < 12 && value === cells[i + 4]));
}
