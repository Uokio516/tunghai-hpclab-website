import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Undo2, Cpu, Trophy } from "lucide-react";
import { PageShell } from "../layout/PageShell";
import { useLocale } from "../../lib/locale";
import { canMove, newRound, slide, spawn, type Direction, type Round } from "../../lib/compute2048";
import "../../styles/games.css";

const BEST_KEY = "hpclab-compute2048-best";
function savedBest() {
  try { const n = Number(localStorage.getItem(BEST_KEY)); return Number.isSafeInteger(n) && n >= 0 ? n : 0; } catch { return 0; }
}

export function GamesPage() {
  const { t } = useLocale();
  const [round, setRound] = useState<Round>(newRound);
  const current = useRef(round);
  const [best, setBest] = useState(savedBest);
  const bestRef = useRef(best);
  const [previous, setPrevious] = useState<Round | null>(null);
  const [continued, setContinued] = useState(false);
  const [effects, setEffects] = useState({ spawn: -1, merged: [] as number[], turn: 0 });
  const [notice, setNotice] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  const peak = Math.max(...round.cells);
  const won = peak >= 2048 && !continued;
  const lost = !canMove(round.cells);
  const milestone = [128, 256, 512, 1024, 2048].find(n => n > peak) ?? 2048;

  function commit(next: Round) { current.current = next; setRound(next); }
  function move(direction: Direction) {
    if ((Math.max(...current.current.cells) >= 2048 && !continued) || !canMove(current.current.cells)) return;
    const result = slide(current.current.cells, direction);
    if (!result.changed) { setNotice(t("這個方向無法移動，試試另一邊。", "Try another direction.")); return; }
    const added = spawn(result.cells);
    const next = { cells: added.cells, score: current.current.score + result.gained, moves: current.current.moves + 1 };
    setPrevious(current.current); commit(next);
    setEffects(old => ({ spawn: added.index, merged: result.merged, turn: old.turn + 1 }));
    if (next.score > bestRef.current) {
      bestRef.current = next.score; setBest(next.score);
      try { localStorage.setItem(BEST_KEY, String(next.score)); } catch { /* Storage can be disabled. */ }
    }
    setNotice(result.gained ? t(`合併成功，增加 ${result.gained} 分。`, `Merged! +${result.gained} points.`) : t("晶片已移動。", "Tiles moved."));
  }
  function restart() {
    setPrevious(current.current); commit(newRound()); setContinued(false);
    setEffects(old => ({ spawn: -1, merged: [], turn: old.turn + 1 }));
    setNotice(t("新的一局開始，可以復原回上一局。", "New round started. Undo restores the previous round."));
    boardRef.current?.focus({ preventScroll: true });
  }
  function undo() {
    if (!previous) return;
    commit(previous); setPrevious(null); setContinued(Math.max(...previous.cells) >= 2048);
    setEffects(old => ({ spawn: -1, merged: [], turn: old.turn + 1 }));
    setNotice(t("已復原上一步。", "Last move undone.")); boardRef.current?.focus({ preventScroll: true });
  }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
    const chosen = direction[event.key] ?? direction[event.key.toLowerCase()];
    if (chosen) { event.preventDefault(); if (!event.repeat) move(chosen); }
  }
  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || (event.target as HTMLElement).closest("button") || won || lost) return;
    gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
  }
  function endGesture(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current; gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up");
  }

  return <div className="games-page"><PageShell eyebrow="HPC LAB / ARCADE" title={t("研究之餘，來一局。", "Take a compute break.")} lede={t("把算力變成遊戲。動動腦，看看你能把晶片合併到多高。", "Turn computing into play. Merge chips and see how far you can go.")}>
    <section className="compute-game" aria-labelledby="compute-title">
      <div className="compute-intro">
        <span className="compute-kicker"><Cpu size={16} /> {t("益智挑戰 · 單人", "PUZZLE · SOLO")}</span>
        <h2 id="compute-title">{t("算力", "Compute")} <em>2048</em></h2>
        <p className="compute-description">{t("相同數字的晶片碰在一起，就能合併成更高算力。從 2 開始，一路挑戰 2048。", "Combine matching chips into bigger ones. Start at 2 and work your way to 2048.")}</p>
        <div className="compute-milestone"><span>{t("下一個里程碑", "Next milestone")}</span><strong>{peak >= 2048 ? t("2048 已達成！", "2048 reached!") : milestone}</strong><div className="compute-progress"><i style={{ width: `${Math.min(100, Math.log2(peak) / Math.log2(milestone) * 100)}%` }} /></div></div>
        <div className="compute-how"><h3>{t("怎麼玩", "How to play")}</h3><p>{t("點一下棋盤，再用方向鍵或 WASD 移動；手機在棋盤上滑動，也可以使用下方方向按鈕。", "Click the board, then use arrow keys or WASD. On mobile, swipe the board or use the direction buttons.")}</p><p>{t("每次有效移動會出現新晶片。同一顆晶片每步只能合併一次，棋盤塞滿且無法合併時結束。", "Each valid move adds a chip. A chip merges once per move. The game ends when no moves remain.")}</p></div>
        <p className="compute-footnote">{t("不用登入。最高分儲存在這台裝置的瀏覽器；重新整理會開始新的一局。數字為遊戲分數。", "No login needed. Your best score stays in this browser; refreshing starts a new round. Numbers are game scores.")}</p>
      </div>
      <div className="compute-console">
        <div className="compute-scores"><div><span>{t("本局得分", "SCORE")}</span><strong data-testid="game-score">{round.score.toLocaleString()}</strong></div><div><span><Trophy size={13} /> {t("個人最高", "BEST")}</span><strong>{best.toLocaleString()}</strong></div><div><span>{t("步數", "MOVES")}</span><strong data-testid="game-moves">{round.moves}</strong></div></div>
        <div className="compute-board" ref={boardRef} tabIndex={0} role="group" aria-label={t("算力 2048 棋盤，使用方向鍵移動", "Compute 2048 board. Use arrow keys to move.")} aria-describedby="game-instruction" data-game-board onKeyDown={onKey} onPointerDown={startGesture} onPointerUp={endGesture} onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}>
          {round.cells.map((value, i) => <div key={`${i}-${effects.turn}`} className={`compute-tile ${value ? "has-chip" : ""} ${effects.spawn === i ? "chip-spawn" : ""} ${effects.merged.includes(i) ? "chip-merge" : ""}`} data-value={value} data-level={value ? Math.min(11, Math.log2(value)) : 0} aria-label={t(`第 ${Math.floor(i / 4) + 1} 列，第 ${i % 4 + 1} 格：${value || "空"}`, `Row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}: ${value || "empty"}`)}>{value > 0 && <><span>{value}</span><small>{value >= 2048 ? "SUPERCOMPUTE" : "COMPUTE"}</small></>}</div>)}
          {(won || lost) && <div className="compute-result"><strong>{won ? t("2048，達成！", "2048 achieved!") : t("這局算力滿載！", "No more moves!")}</strong><p>{won ? lost ? t("你已完成挑戰！棋盤已滿，可以再開一局。", "Challenge complete! No moves remain. Try a new round.") : t("你已完成挑戰，也可以繼續突破紀錄。", "Challenge complete. Keep going for a higher score.") : t("試著把最大的晶片留在角落，再挑戰一次。", "Try keeping the largest chip in a corner next time.")}</p><div>{won && !lost && <button onClick={() => { setContinued(true); boardRef.current?.focus(); }}>{t("繼續挑戰", "Keep playing")}</button>}{lost && previous && <button onClick={undo}>{t("復原一步", "Undo move")}</button>}<button onClick={restart}>{t("再來一局", "Play again")}</button></div></div>}
        </div>
        <p id="game-instruction" className="compute-instruction">{t("點選棋盤後，用方向鍵移動 · 或直接滑動", "Select board + arrow keys · or swipe")}</p>
        <div className="compute-controls"><div className="compute-directions">{([["left", ArrowLeft, "左", "Left"], ["up", ArrowUp, "上", "Up"], ["down", ArrowDown, "下", "Down"], ["right", ArrowRight, "右", "Right"]] as const).map(([direction, Icon, zh, en]) => <button key={direction} disabled={won || lost} onClick={() => move(direction)} aria-label={t(`向${zh}移動`, `Move ${en.toLowerCase()}`)}><Icon size={19} /></button>)}</div><div className="compute-actions"><button onClick={undo} disabled={!previous}><Undo2 size={16} />{t("復原", "Undo")}</button><button onClick={restart}><RotateCcw size={16} />{t("新遊戲", "New game")}</button></div></div>
        <p className="compute-notice" role="status" aria-live="polite">{notice || t("準備好了，就開始合併第一顆晶片。", "Ready when you are. Merge your first chip.")}</p>
        <details className="compute-mobile-help"><summary>{t("遊戲規則與紀錄", "Rules and saved scores")}</summary><p>{t("滑動棋盤或按方向按鈕，合併相同數字。每步只能合併一次；每次有效移動會增加一顆晶片。沒有可行的移動時結束。最高分存在本機瀏覽器，重新整理會開始新的一局。", "Swipe or use the direction buttons to merge matching numbers. Each chip merges once per move; valid moves add a chip. No moves left means game over. Best scores are saved in this browser; refreshing starts a new round.")}</p></details>
        <p className="compute-credit">{t("玩法致敬 Gabriele Cirulli 的 2048。", "Inspired by 2048 by Gabriele Cirulli.")}</p>
      </div>
    </section>
  </PageShell></div>;
}
