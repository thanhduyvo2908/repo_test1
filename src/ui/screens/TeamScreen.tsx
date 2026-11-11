import { MAX_TEAM_SIZE, setTeam } from "../../core/progress";
import { ElementBadge } from "../common";
import { useStore } from "../store";

/** Pick up to five characters and their battle order. */
export function TeamScreen() {
  const { pack, game, updateGame, t, l } = useStore();

  const toggle = (characterId: string) => {
    updateGame((g) =>
      g.team.includes(characterId)
        ? setTeam(g, g.team.filter((id) => id !== characterId))
        : setTeam(g, [...g.team, characterId]),
    );
  };

  const moveUp = (index: number) => {
    updateGame((g) => {
      const team = [...g.team];
      const [member] = team.splice(index, 1);
      if (member) team.splice(index - 1, 0, member);
      return setTeam(g, team);
    });
  };

  return (
    <>
      <h2>{t("team.title")}</h2>
      <p className="small muted">{t("team.hint", { max: MAX_TEAM_SIZE })}</p>

      <h3>{t("team.order")}</h3>
      <ol className="card-list">
        {game.team.map((characterId, index) => {
          const character = pack.characters.get(characterId);
          if (!character) return null;
          return (
            <li key={characterId} className="card row">
              <span className="order-number">{index + 1}</span>
              <strong>{l(character.name)}</strong>
              <ElementBadge element={character.element} />
              {index > 0 && (
                <button type="button" className="link-button push-right" onClick={() => moveUp(index)}>
                  ↑ {t("team.moveUp")}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {game.team.length === 1 && <p className="small muted">{t("team.lastMember")}</p>}

      <h3>{t("team.roster")}</h3>
      <ul className="card-list">
        {game.roster.map(({ characterId, level }) => {
          const character = pack.characters.get(characterId);
          if (!character) return null;
          const inTeam = game.team.includes(characterId);
          const full = !inTeam && game.team.length >= MAX_TEAM_SIZE;
          const last = inTeam && game.team.length === 1;
          return (
            <li key={characterId}>
              <button
                type="button"
                className={`card card-button row${inTeam ? " selected" : ""}`}
                disabled={full || last}
                aria-pressed={inTeam}
                onClick={() => toggle(characterId)}
              >
                <strong>{l(character.name)}</strong>
                <ElementBadge element={character.element} />
                <span className="muted">{t("team.level", { level })}</span>
                <span className="muted small push-right">{t(`damageType.${character.damageType}`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
