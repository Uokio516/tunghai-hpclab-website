import assert from "node:assert/strict";
import { slide, spawn, canMove, newRound, type Direction } from "../src/lib/compute2048";
const row = (...values: number[]) => [...values, ...Array(12).fill(0)];
assert.deepEqual(slide(row(2,2,2,2), "left").cells.slice(0,4),[4,4,0,0]);
assert.equal(slide(row(2,2,2,2), "left").gained,8);
assert.deepEqual(slide(row(2,2,4,0), "left").cells.slice(0,4),[4,4,0,0],"No double merge in one turn");
assert.deepEqual(slide(row(2,2,2,0), "right").cells.slice(0,4),[0,0,2,4]);
assert.deepEqual(slide(row(2,0,2,4), "left").cells.slice(0,4),[4,4,0,0]);
assert.equal(slide(row(2,4,8,16), "left").changed,false);
const column=Array(16).fill(0);column[0]=2;column[4]=2;column[8]=2;column[12]=2;
assert.deepEqual(slide(column,"up").cells.filter((_,i)=>i%4===0),[4,4,0,0]);
assert.deepEqual(slide(column,"down").cells.filter((_,i)=>i%4===0),[0,0,4,4]);
const dead=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];assert.equal(canMove(dead),false);
assert.equal(canMove([0,...dead.slice(1)]),true);
assert.equal(canMove([4,...dead.slice(1)]),true);
assert.deepEqual(spawn(dead).cells,dead);
assert.equal(spawn(Array(16).fill(0),()=>0).cells[0],2);
assert.equal(spawn(Array(16).fill(0),()=>.99).cells[15],4);
assert.equal(newRound().cells.filter(Boolean).length,2);
assert.equal(slide(row(1024,1024,0,0),"left").cells[0],2048);
const lastWin=spawn(slide([1024,1024,8,16,4,16,32,64,8,32,64,128,16,64,128,256],"left").cells,()=>0).cells;
assert.equal(Math.max(...lastWin),2048);assert.equal(canMove(lastWin),false,"Win can also fill the board without any remaining moves");
for(let i=0;i<300;i++) {
  const cells=Array.from({length:16},()=>Math.random()<.3?0:2**(1+Math.floor(Math.random()*8)));
  for(const direction of ["left","right","up","down"] as Direction[]) {
    const before=[...cells],result=slide(cells,direction);
    assert.deepEqual(cells,before,"Input must remain immutable for undo");
    assert.equal(result.cells.reduce((a,b)=>a+b,0),cells.reduce((a,b)=>a+b,0),"Moves preserve tile sum");
    assert.equal(result.changed,result.cells.some((value,index)=>value!==cells[index]));
    assert.equal(canMove(cells),["left","right","up","down"].some(d=>slide(cells,d as Direction).changed)||cells.every(v=>v===0));
  }
}
console.log("PASS: merges, scoring, directions, immutability, invalid moves, win/loss and spawning");
