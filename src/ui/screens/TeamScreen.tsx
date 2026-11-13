import { useState } from "react";
import { ELEMENTS, type Element } from "../../content/schema";
import { MAX_TEAM_SIZE, setTeam } from "../../core/progress";
import { ElementBadge } from "../common";
import { useNav } from "../nav";
import { Portrait } from "../SpriteFrame";
import { useStore } from "../store";

type Sort = "level" | "element" | "name";

/** Battle order on top, the whole roster below. Proposal 5.8 in docs/ui/research.md. */
export function TeamScreen() {
  const { pack, game, updateGame, t, l } = useStore();
  const { openSheet } = useNav();
  const [filter, setFilter] = useState<Element | null>(null);
  const [sort, setSort] = useState<Sort>("level");

  const toggle = (characterId: string) => {
    updateGame((g) =>
      g.team.includes(characterId)
        ? setTeam(g, g.team.filter((id) => id !== characterId))
        : setTeam(g, [...g.team, characterId]),
    );
  };

  const move = (index: number, by: -1 | 1) => {
    updateGame((g) => {
      const team = [...g.team];
      const [member] = team.splice(index, 1);
      if (member) team.splice(index + by, 0, member);
      return setTeam(g, team);
    });
  };

  const rosterElements = ELEMENTS.filter((e) => game.roster.some((c) => pack.characters.get(c.characterId)?.element === e));
  const roster = game.roster
    .filter((c) => {
      const character = pack.characters.get(c.characterId);
      return character && (filter === null || character.element === filter);
    })
    .sort((a, b) => {
      const ca = pack.characters.get(a.characterId)!;
      const cb = pack.characters.get(b.characterId)!;
      if (sort === "level") return b.level - a.level || l(ca.name).localeCompare(l(cb.name));
      if (sort === "element") return ELEMENTS.indexOf(ca.element) - ELEMENTS.indexOf(cb.element) || b.level - a.level;
      return l(ca.name).localeCompare(l(cb.name));
    });

  return (
    <div className="team-tab">
      <section className="card">
        <h2 className="h px">
          {t("team.order")}
          <span className="right small muted">
            {game.team.length}/{MAX_TEAM_SIZE}
          </span>
        </h2>
        <p className="small muted">{t("team.orderHint")}</p>
        <ol className="team-slots">
          {Array.from({ length: MAX_TEAM_SIZE }, (_, index) => {
            const characterId = game.team[index];
            const character = characterId ? pack.characters.get(characterId) : undefined;
            const owned = characterId ? game.roster.find((c) => c.characterId === characterId) : undefined;
            if (!characterId || !character || !owned) {
              return (
                <li key={index} className="team-slot empty">
                  <span className="slot-no px">{index + 1}</span>
                  <span className="small muted">{t("team.freeSlot")}</span>
                </li>
              );
            }
            const item = owned.itemUid !== null ? game.items.find((i) => i.uid === owned.itemUid) : undefined;
            return (
              <li key={characterId} className="team-slot">
                <span className="slot-no px">{index + 1}</span>
                <button type="button" className="slot-main" onClick={() => openSheet({ kind: "character", characterId })}>
                  <Portrait id={characterId} size={44} element={character.element} name={l(character.name)} />
                  <span className="grow">
                    <span className="px block">{l(character.name)}</span>
                    <span className="small muted">
                      <ElementBadge element={character.element} /> {t("team.levelShort", { level: owned.level })}{" "}
                      <span className="gold">{"★".repeat(owned.stars)}</span>
                      {item && <span className={`t-${item.tier}`}> ◈</span>}
                    </span>
                  </span>
                </button>
                <span className="slot-moves">
                  <button
                    type="button"
                    className="iconbtn"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={t("team.moveUp")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    disabled={index === game.team.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={t("team.moveDown")}
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        {game.team.length === 1 && <p className="small muted">{t("team.lastMember")}</p>}
      </section>

      <section className="card">
        <h2 className="h px">
          {t("team.roster")}
          <span className="right small muted">{game.roster.length}</span>
        </h2>
        <p className="small muted">{t("team.rosterHint", { max: MAX_TEAM_SIZE })}</p>
        <div className="filters">
          <button type="button" className={`pill px${filter === null ? " on" : ""}`} onClick={() => setFilter(null)}>
            {t("filter.all")}
          </button>
          {rosterElements.map((e) => (
            <button key={e} type="button" className={`pill px${filter === e ? " on" : ""}`} onClick={() => setFilter(e)}>
              {t(`element.${e}`)}
            </button>
          ))}
          <label className="sort small">
            <span className="muted">{t("filter.sort")}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="level">{t("filter.byLevel")}</option>
              <option value="element">{t("filter.byElement")}</option>
              <option value="name">{t("filter.byName")}</option>
            </select>
          </label>
        </div>
        <ul className="roster-grid">
          {roster.map(({ characterId, level, stars }) => {
            const character = pack.characters.get(characterId)!;
            const inTeam = game.team.includes(characterId);
            const full = !inTeam && game.team.length >= MAX_TEAM_SIZE;
            const last = inTeam && game.team.length === 1;
            return (
              <li key={characterId} className={`roster-card${inTeam ? " in-team" : ""}`}>
                <button
                  type="button"
                  className="roster-main"
                  disabled={full || last}
                  aria-pressed={inTeam}
                  onClick={() => toggle(characterId)}
                  title={inTeam ? t("team.remove") : full ? t("team.full") : t("team.add")}
                >
                  <Portrait id={characterId} size={48} element={character.element} name={l(character.name)} />
                  <span className="px roster-name">{l(character.name)}</span>
                  <span className="small">
                    <ElementBadge element={character.element} />
                  </span>
                  <span className="small muted">
                    {t("team.levelShort", { level })} <span className="gold">{"★".repeat(stars)}</span>
                  </span>
                  {inTeam && <span className="in-team-mark px">{game.team.indexOf(characterId) + 1}</span>}
                </button>
                <button
                  type="button"
                  className="info-button"
                  onClick={() => openSheet({ kind: "character", characterId })}
                  aria-label={t("team.details")}
                >
                  ⓘ
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
