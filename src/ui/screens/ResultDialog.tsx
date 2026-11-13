import { dungeonAttemptsLeft } from "../../core/dungeons";
import { MAX_TEAM_SIZE } from "../../core/progress";
import { useAdventure } from "../adventure";
import { Dialog, ElementBadge } from "../common";
import { Figure } from "../SpriteFrame";
import { todayKey, useStore } from "../store";
import { CounterHint } from "./AdventureScreen";

/** The card after a boss or side dungeon fight: recruit, rewards, or what went wrong. */
export function ResultDialog() {
  const { pack, game, t, l, n } = useStore();
  const { battle, phase, closeResult, retry, addToTeam } = useAdventure();
  if (phase !== "result" || !battle || battle.target.kind === "stage") return null;
  const { target, result, rewards } = battle;
  const won = result.winner === "player";
  const bossUnit = result.units.find((u) => u.kind === "boss");
  const bossId = bossUnit?.sourceId ?? "";
  const boss = pack.characters.get(bossId);
  const bossName = boss ? l(boss.name) : bossId;
  const recruited = rewards?.recruited ?? null;
  const nextMap = battle.nextMapId ? pack.maps.get(battle.nextMapId) : undefined;
  const inTeam = recruited ? game.team.includes(recruited.characterId) : false;
  const teamFull = game.team.length >= MAX_TEAM_SIZE;

  const itemLine = (itemId: string, tier: string) => {
    const item = pack.items.get(itemId);
    return (
      <div className="row reward-item">
        <span className="item-icon">◈</span>
        <span className={`px t-${tier}`}>
          {t("result.itemTier", { item: item ? l(item.name) : itemId, tier: t(`tier.${tier as "common"}`) })}
        </span>
      </div>
    );
  };

  const rewardsCard = won && (
    <div className="card rewards">
      <div className="small muted">{t("rewards.title")}</div>
      {rewards && (
        <div className="row px reward-res">
          <span>+{n(rewards.resources.gold)} {t("adventure.goldUnit")}</span>
          <span>+{n(rewards.resources.food)} {t("adventure.foodUnit")}</span>
        </div>
      )}
      {battle.starMaterial > 0 && <div className="px gold">{t("rewards.starMaterial", { amount: battle.starMaterial })}</div>}
      {rewards?.item && itemLine(rewards.item.itemId, rewards.item.tier)}
      {rewards && !rewards.item && target.kind === "boss" && pack.maps.get(target.mapId)?.boss.dropItemId && (
        <div className="small muted">{t("rewards.noItem")}</div>
      )}
      {rewards?.completionItems.map((item) => <div key={item.uid}>{itemLine(item.itemId, item.tier)}</div>)}
      {rewards?.worldCompleted && <div className="small win">{t("rewards.worldComplete")}</div>}
      {nextMap && <div className="small win">🔓 {t("result.mapOpened", { map: l(nextMap.name) })}</div>}
      {target.kind === "dungeon" && (
        <div className="small muted">
          {t("dungeon.attemptsLeft", {
            left: dungeonAttemptsLeft(game, pack, todayKey()),
            max: pack.balance.sideDungeon.attemptsPerDay,
          })}
        </div>
      )}
    </div>
  );

  if (won && recruited) {
    const character = pack.characters.get(recruited.characterId);
    return (
      <Dialog labelledBy="result-title" className="result recruit">
        <header className="result-head">
          <h2 className="px" id="result-title">
            {character ? l(character.name) : recruited.characterId}
          </h2>
          <span className="new px">{t("result.new")}</span>
          <span className="grow" />
          <span className="px small muted">{t("result.recruited")}</span>
        </header>
        <div className="result-body">
          <div className="art">
            <Figure id={recruited.characterId} scale={1.9} element={character?.element} name={character ? l(character.name) : ""} />
          </div>
          <div className="grow">
            <div className="row">
              {character && <ElementBadge element={character.element} />}
              {character && <span className="pill px">{t(`damageType.${character.damageType}`)}</span>}
            </div>
            <div className="facts two">
              <div className="fact">
                <div className="k">{t("result.level")}</div>
                <div className="v px">{recruited.level}</div>
              </div>
              <div className="fact">
                <div className="k">{t("result.stars")}</div>
                <div className="v px gold">{"★".repeat(recruited.stars)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="result-rewards">{rewardsCard}</div>
        <footer className="result-actions">
          {!inTeam && !teamFull && (
            <button type="button" className="btn ghost" onClick={() => addToTeam(recruited.characterId)}>
              {t("result.addToTeam")}
            </button>
          )}
          {inTeam && <span className="small muted grow center">{t("result.inTeam")}</span>}
          <Continue />
        </footer>
      </Dialog>
    );
  }

  if (won) {
    return (
      <Dialog labelledBy="result-title" className="result">
        <header className="result-head win-head">
          <h2 className="px" id="result-title">
            {t("battle.victory")}
          </h2>
          <span className="grow" />
          <span className="px small muted">{bossName}</span>
        </header>
        <div className="result-rewards">
          {rewards && rewards.recruitChance !== null && rewards.recruitChance > 0 && (
            <p className="small">
              {t("rewards.notRecruited", { name: bossName, percent: Math.round(rewards.recruitChance * 100) })}
            </p>
          )}
          {rewards && rewards.recruitChance === null && target.kind === "boss" && (
            <p className="small muted">{t("mapInfo.alreadyOwned")}</p>
          )}
          {rewardsCard}
        </div>
        <footer className="result-actions">
          <Continue />
        </footer>
      </Dialog>
    );
  }

  const hpLeft = bossUnit ? (result.finalHp[bossUnit.uid] ?? 0) : 0;
  const maxHp = bossUnit?.maxHp ?? 1;
  return (
    <Dialog labelledBy="result-title" className="result">
      <header className="result-head lose-head">
        <h2 className="px" id="result-title">
          {t("battle.defeat")}
        </h2>
        <span className="grow" />
        <span className="px small muted">{bossName}</span>
      </header>
      <div className="result-rewards">
        {result.winner === null && <p className="small">{t("battle.timeout")}</p>}
        <p className="small">
          {t("result.bossHpLeft", { name: bossName, hp: n(hpLeft), max: n(maxHp), percent: Math.ceil((100 * hpLeft) / maxHp) })}
        </p>
        {target.kind === "boss" && <CounterHint mapId={target.mapId} />}
      </div>
      <footer className="result-actions">
        <button type="button" className="btn ghost" onClick={() => closeResult("grind")}>
          {t("result.backToGrind")}
        </button>
        <button type="button" className="btn" onClick={retry}>
          {t("adventure.retry")}
        </button>
      </footer>
    </Dialog>
  );

  function Continue() {
    return nextMap ? (
      <button type="button" className="btn gold" onClick={() => closeResult("nextMap")}>
        {t("result.nextMap")}
      </button>
    ) : (
      <button type="button" className="btn" onClick={() => closeResult("grind")}>
        {t("result.continue")}
      </button>
    );
  }
}
