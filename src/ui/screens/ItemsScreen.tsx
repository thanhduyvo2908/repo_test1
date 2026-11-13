import { useState } from "react";
import { ITEM_TIERS, type ItemTier } from "../../content/schema";
import { decomposeItem, exchangeDust, exchangeableItems, wearerOf } from "../../core/inventory";
import { ok, type ActionError, type ActionResult, type GameState } from "../../core/progress";
import type { Pack } from "../../content/loader";
import { Bar, Dialog } from "../common";
import { Portrait } from "../SpriteFrame";
import { errorKey, useStore } from "../store";

type WornFilter = "all" | "worn" | "free";

/** Breaks several items in one go; stops at the first that cannot break. */
function decomposeMany(state: GameState, pack: Pack, uids: readonly number[]): ActionResult {
  let current = state;
  for (const uid of uids) {
    const result = decomposeItem(current, pack, uid);
    if (!result.ok) return result;
    current = result.state;
  }
  return ok(current);
}

/** Owned items, breaking them into dust, and the dust exchange. Proposal 5.9 in docs/ui/research.md. */
export function ItemsScreen() {
  const { pack, game, runAction, t, l, n } = useStore();
  const [error, setError] = useState<ActionError | null>(null);
  const [tier, setTier] = useState<ItemTier | null>(null);
  const [worn, setWorn] = useState<WornFilter>("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const exchangeable = exchangeableItems(pack);
  const [choice, setChoice] = useState<string | null>(null);
  const cost = pack.balance.drops.dustForLegendary;

  const items = game.items.filter((item) => {
    if (tier && item.tier !== tier) return false;
    const wearer = wearerOf(game, item.uid);
    if (worn === "worn" && !wearer) return false;
    if (worn === "free" && wearer) return false;
    return true;
  });
  const chosen = game.items.filter((item) => selected.has(item.uid));
  const dustTotal = chosen.reduce((sum, item) => sum + pack.balance.drops.dustPerTier[item.tier], 0);

  const toggle = (uid: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  return (
    <div className="items-tab">
      <section className="card">
        <h2 className="h px">
          {t("items.title")}
          <span className="right small">
            <span className="glyph">◈</span> {t("items.dustHave", { dust: n(game.dust) })}
          </span>
        </h2>
        {error && (
          <p className="error small" role="alert">
            {t(errorKey(error))}
          </p>
        )}
        <div className="filters">
          <button type="button" className={`pill px${tier === null ? " on" : ""}`} onClick={() => setTier(null)}>
            {t("filter.all")}
          </button>
          {ITEM_TIERS.map((value) => (
            <button key={value} type="button" className={`pill px t-${value}${tier === value ? " on" : ""}`} onClick={() => setTier(value)}>
              {t(`tier.${value}`)}
            </button>
          ))}
          <select className="small" value={worn} onChange={(event) => setWorn(event.target.value as WornFilter)} aria-label={t("items.wornFilter")}>
            <option value="all">{t("items.wornAll")}</option>
            <option value="worn">{t("items.wornOnly")}</option>
            <option value="free">{t("items.freeOnly")}</option>
          </select>
        </div>

        {game.items.length === 0 ? (
          <p className="small muted">{t("items.empty")}</p>
        ) : items.length === 0 ? (
          <p className="small muted">{t("items.noMatch")}</p>
        ) : (
          <ul className="item-grid">
            {items.map((item) => {
              const def = pack.items.get(item.itemId);
              const wearer = wearerOf(game, item.uid);
              const wearerChar = wearer ? pack.characters.get(wearer) : undefined;
              const isSelected = selected.has(item.uid);
              return (
                <li key={item.uid}>
                  <button
                    type="button"
                    className={`item-card tier-${item.tier}${isSelected ? " selected" : ""}`}
                    aria-pressed={selecting ? isSelected : undefined}
                    onClick={() => (selecting ? toggle(item.uid) : undefined)}
                    tabIndex={selecting ? 0 : -1}
                  >
                    {selecting && <span className="check" aria-hidden="true">{isSelected ? "☑" : "☐"}</span>}
                    <span className="px item-name">{def ? l(def.name) : item.itemId}</span>
                    <span className={`small t-${item.tier}`}>
                      {t(`tier.${item.tier}`)}
                      {def && ` · +${Math.round(def.effect.valueByTier[item.tier] * 100)}%`}
                    </span>
                    {def && <span className="small muted item-desc">{l(def.description)}</span>}
                    {wearerChar && (
                      <span className="item-wearer" title={t("items.wornBy", { name: l(wearerChar.name) })}>
                        <Portrait id={wearerChar.id} size={22} element={wearerChar.element} name={l(wearerChar.name)} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {game.items.length > 0 &&
          (selecting ? (
            <div className="break-bar">
              <span className="small grow">{t("items.selected", { count: chosen.length, dust: dustTotal })}</span>
              <button type="button" className="btn ghost" onClick={stopSelecting}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn" disabled={chosen.length === 0} onClick={() => setConfirming(true)}>
                {t("items.breakButton")}
              </button>
            </div>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setSelecting(true)}>
              {t("items.selectToBreak")}
            </button>
          ))}
      </section>

      {exchangeable.length > 0 && (
        <section className="card">
          <h2 className="h px">{t("items.exchange")}</h2>
          <p className="small muted">{t("items.exchangeHint", { cost })}</p>
          <div className="row dust-row">
            <Bar kind="progress" ratio={game.dust / cost} />
            <span className="px small">
              {n(game.dust)}/{cost}
            </span>
          </div>
          <ul className="item-grid">
            {exchangeable.map((itemId) => {
              const def = pack.items.get(itemId);
              const owner = def ? pack.characters.get(def.ownerId) : undefined;
              return (
                <li key={itemId}>
                  <button
                    type="button"
                    className={`item-card tier-legendary${choice === itemId ? " selected" : ""}`}
                    aria-pressed={choice === itemId}
                    onClick={() => setChoice(itemId)}
                  >
                    <span className="px item-name">{def ? l(def.name) : itemId}</span>
                    <span className="small t-legendary">
                      {t("tier.legendary")}
                      {def && ` · +${Math.round(def.effect.valueByTier.legendary * 100)}%`}
                    </span>
                    {owner && (
                      <span className="item-wearer">
                        <Portrait id={owner.id} size={22} element={owner.element} name={l(owner.name)} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="btn gold block"
            disabled={game.dust < cost || !choice}
            onClick={() => choice && setError(runAction((g) => exchangeDust(g, pack, choice)))}
          >
            {t("items.exchangeButton")}
          </button>
        </section>
      )}

      {confirming && (
        <BreakConfirm
          uids={chosen.map((i) => i.uid)}
          dust={dustTotal}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            const uids = chosen.map((i) => i.uid);
            setError(runAction((g) => decomposeMany(g, pack, uids)));
            setConfirming(false);
            stopSelecting();
          }}
        />
      )}
    </div>
  );
}

/** Asks before breaking items. Worn or Legendary items need a second, explicit tick. */
function BreakConfirm({
  uids,
  dust,
  onCancel,
  onConfirm,
}: {
  uids: number[];
  dust: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { pack, game, t, l } = useStore();
  const [sure, setSure] = useState(false);
  const items = game.items.filter((i) => uids.includes(i.uid));
  const risky = items.filter((i) => i.tier === "legendary" || wearerOf(game, i.uid) !== null);
  return (
    <Dialog labelledBy="break-title" onClose={onCancel}>
      <h2 className="px" id="break-title">
        {t("items.confirmTitle")}
      </h2>
      <p className="small">{t("items.confirmBody", { count: items.length, dust })}</p>
      <ul className="small confirm-list">
        {items.map((item) => {
          const def = pack.items.get(item.itemId);
          const wearer = wearerOf(game, item.uid);
          const wearerName = wearer ? pack.characters.get(wearer)?.name : undefined;
          return (
            <li key={item.uid}>
              <span className={`t-${item.tier}`}>
                {def ? l(def.name) : item.itemId} · {t(`tier.${item.tier}`)}
              </span>
              {wearerName && <span className="muted"> · {t("items.wornBy", { name: l(wearerName) })}</span>}
            </li>
          );
        })}
      </ul>
      <p className="small muted">{t("items.confirmIrreversible")}</p>
      {risky.length > 0 && (
        <label className="warn small">
          <input type="checkbox" checked={sure} onChange={(event) => setSure(event.target.checked)} />
          {t("items.confirmRisky", { count: risky.length })}
        </label>
      )}
      <div className="row dialog-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button type="button" className="btn" disabled={risky.length > 0 && !sure} onClick={onConfirm}>
          {t("items.breakConfirm", { dust })}
        </button>
      </div>
    </Dialog>
  );
}
