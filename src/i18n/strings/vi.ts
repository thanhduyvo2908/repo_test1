import type { StringKey } from "./en";

// Vietnamese string table. Missing keys fall back to English.
export const vi: Partial<Record<StringKey, string>> = {
  "app.title": "Xidle",
  "app.tagline": "Phiêu lưu crossover tự động",

  "settings.language": "Ngôn ngữ",
  "lang.en": "English",
  "lang.vi": "Tiếng Việt",

  "home.starter": "Nhân vật khởi đầu: {name}",
  "home.maps": "Bản đồ",

  "map.stageCount": "{count} màn",
  "map.boss": "Boss: {name} (Lv {level})",
  "map.recruitRate": "Tỉ lệ chiêu mộ: {percent}%",

  "element.metal": "Kim",
  "element.wood": "Mộc",
  "element.water": "Thủy",
  "element.fire": "Hỏa",
  "element.earth": "Thổ",
  "element.light": "Ánh sáng",
  "element.dark": "Bóng tối",

  "damageType.physical": "Vật lý",
  "damageType.magic": "Phép",

  "stat.hp": "HP",
  "stat.atk": "Công vật lý",
  "stat.def": "Thủ vật lý",
  "stat.spa": "Công phép",
  "stat.spd": "Thủ phép",
  "stat.spe": "Tốc độ",
};
