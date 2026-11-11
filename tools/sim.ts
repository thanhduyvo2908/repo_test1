// Batch battle simulation for balance checks. The battle core lands in roadmap step 2;
// until then this only validates the pack and prints a summary.
import { loadPack } from "../src/content/loader";
import { placeholderPackData } from "../packs/placeholder";

const pack = loadPack(placeholderPackData);
console.log(
  `Pack "${pack.manifest.id}": ${pack.characters.size} characters, ${pack.enemies.size} enemies, ` +
    `${pack.maps.size} maps.`,
);
console.log("Battle simulation is not implemented yet (roadmap step 2).");
