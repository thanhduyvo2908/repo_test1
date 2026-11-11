// English string table. English is the default language and must contain every key.
// Placeholders use {name} syntax and must match between languages.
export const en = {
  "app.title": "Xidle",
  "app.tagline": "Idle crossover adventure",

  "settings.language": "Language",
  "lang.en": "English",
  "lang.vi": "Tiếng Việt",

  "home.starter": "Starter: {name}",
  "home.maps": "Maps",

  "map.stageCount": "{count} stages",
  "map.boss": "Boss: {name} (Lv {level})",
  "map.recruitRate": "Recruit chance: {percent}%",

  "element.metal": "Metal",
  "element.wood": "Wood",
  "element.water": "Water",
  "element.fire": "Fire",
  "element.earth": "Earth",
  "element.light": "Light",
  "element.dark": "Dark",

  "damageType.physical": "Physical",
  "damageType.magic": "Magic",

  "stat.hp": "HP",
  "stat.atk": "Attack",
  "stat.def": "Defense",
  "stat.spa": "Magic Attack",
  "stat.spd": "Magic Defense",
  "stat.spe": "Speed",
} as const;

export type StringKey = keyof typeof en;
