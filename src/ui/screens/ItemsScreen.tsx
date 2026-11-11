import { useState } from "react";
import { decomposeItem, exchangeDust, exchangeableItems, wearerOf } from "../../core/inventory";
import type { ActionError } from "../../core/progress";
import { errorKey, useStore } from "../store";

/** Owned items, breaking them into dust, and the dust exchange. */
export function ItemsScreen() {
  const { pack, game, runAction, t, l } = useStore();
  const [error, setError] = useState<ActionError | null>(null);
  const exchangeable = exchangeableItems(pack);
  const [choice, setChoice] = useState(exchangeable[0] ?? "");
  const cost = pack.balance.drops.dustForLegendary;

  return (
    <>
      <h2>{t("items.title")}</h2>
      {error && (
        <p className="error small" role="alert">
          {t(errorKey(error))}
        </p>
      )}

      {game.items.length === 0 ? (
        <p className="small muted">{t("items.empty")}</p>
      ) : (
        <ul className="card-list">
          {game.items.map((item) => {
            const def = pack.items.get(item.itemId);
            const wearer = wearerOf(game, item.uid);
            const wearerName = wearer ? pack.characters.get(wearer)?.name : undefined;
            return (
              <li key={item.uid} className="card">
                <div className="row">
                  <strong>{def ? l(def.name) : item.itemId}</strong>
                  <span className={`tier tier-${item.tier} small`}>{t(`tier.${item.tier}`)}</span>
                </div>
                {def && (
                  <p className="small">
                    {l(def.description)} (+{Math.round(def.effect.valueByTier[item.tier] * 100)}%)
                  </p>
                )}
                {wearerName && <p className="small muted">{t("items.wornBy", { name: l(wearerName) })}</p>}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setError(runAction((g) => decomposeItem(g, pack, item.uid)))}
                >
                  {t("items.decompose", { dust: pack.balance.drops.dustPerTier[item.tier] })}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {exchangeable.length > 0 && (
        <section className="card exchange">
          <h3>{t("items.exchange")}</h3>
          <p className="small">{t("items.exchangeHint", { cost })}</p>
          <select
            className="select"
            value={choice}
            aria-label={t("items.exchange")}
            onChange={(event) => setChoice(event.target.value)}
          >
            {exchangeable.map((itemId) => {
              const def = pack.items.get(itemId);
              return (
                <option key={itemId} value={itemId}>
                  {def ? l(def.name) : itemId}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            className="primary-button"
            disabled={game.dust < cost || !choice}
            onClick={() => setError(runAction((g) => exchangeDust(g, pack, choice)))}
          >
            {t("items.exchangeButton")}
          </button>
        </section>
      )}
    </>
  );
}
