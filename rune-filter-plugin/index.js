const fs = require("fs");
const path = require("path");

module.exports = {
  pluginName: "Rune Filter",
  pluginDescription: "Hilft beim Runen aussortieren mit Punkte-System",
  pluginVersion: "1.6.0",

  defaultConfig: {
    threshold: 6,
    importantSets: ["Violent", "Will", "Swift", "Fatal", "Rage"],
    speedPoints: 2,
    effThreshold: 85,
    effPoints: 2,
    minUpgradeLevel: 6,
    exportFile: "rune_filter_results.csv"
  },

  run: async function (data, settings, log) {
    if (!data.runes) return;

    let results = ["Slot,Set,Mainstat,Subs,Efficiency,Score,Decision,Details"];

    data.runes.forEach(rune => {
      if (rune.upgrade_curr < settings.minUpgradeLevel) {
        log(`Rune Slot ${rune.slot} (${rune.set}) +${rune.upgrade_curr} → Warten auf Upgrade`);
        return;
      }

      if ([2, 4, 6].includes(rune.slot)) {
        const flatMains = ["HP", "ATK", "DEF"];
        if (flatMains.includes(rune.pri_eff[0])) {
          log(`Rune Slot ${rune.slot} (${rune.set}) +${rune.upgrade_curr} → SELL (Flat Mainstat)`);
          return;
        }
      }

      let points = 0;
      let details = [];

      if (settings.importantSets.includes(rune.set)) {
        points += 2;
        details.push("Set+2");
      }

      if (rune.efficiency >= settings.effThreshold) {
        points += settings.effPoints;
        details.push(`Eff+${settings.effPoints}`);
      }

      const spdSub = rune.sec_eff.find(s => s[0] === "SPD");
      if (spdSub) {
        let spdPoints = settings.speedPoints;
        spdPoints += Math.floor(spdSub[1] / 5);
        if ([1, 3, 5].includes(rune.slot)) spdPoints = Math.round(spdPoints * 1.5);
        points += spdPoints;
        details.push(`SPD+${spdPoints}`);
      }

      const goodSubsList = ["SPD", "CRI Rate", "CRI Dmg", "ATK%", "HP%", "DEF%"];
      const goodSubs = rune.sec_eff.filter(s => goodSubsList.includes(s[0]));
      if (goodSubs.length >= 3) {
        points += 2;
        details.push("Subs+2");
      }

      if (rune.slot === 6 && ["ACC", "RES"].includes(rune.pri_eff[0])) {
        if (!spdSub || spdSub[1] < 15) {
          log(`Rune Slot 6 (${rune.set}) +${rune.upgrade_curr} → SELL (ACC/RES ohne guten SPD)`);
          return;
        }
      }

      if (rune.slot === 4 && ["ATK%", "CRI Rate"].includes(rune.pri_eff[0])) {
        const goodSubs4 = rune.sec_eff.filter(s => ["SPD", "CRI Rate", "CRI Dmg", "ATK%"].includes(s[0]));
        if (goodSubs4.length < 2) {
          log(`Rune Slot 4 (${rune.set}) +${rune.upgrade_curr} → SELL (ATK/CR Main ohne gute Subs)`);
          return;
        } else {
          points += 2;
          details.push("Main+2");
        }
      }

      const decision = points >= settings.threshold ? "KEEP" : "SELL";

      log(`Rune Slot ${rune.slot} (${rune.set}) +${rune.upgrade_curr} → Score=${points} → ${decision} [${details.join(", ")}]`);

      const subs = rune.sec_eff.map(s => `${s[0]}+${s[1]}`).join(" | ");
      results.push(`${rune.slot},${rune.set},${rune.pri_eff[0]}+${rune.pri_eff[1]},${subs},${rune.efficiency},${points},${decision},"${details.join(", ")}"`);
    });

    const filePath = path.join(__dirname, settings.exportFile);
    fs.writeFileSync(filePath, results.join("\n"), "utf8");

    log(`Rune Filter Ergebnisse exportiert nach: ${filePath}`);
  }
};
