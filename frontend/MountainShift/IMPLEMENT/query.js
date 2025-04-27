// scripts/query.js
const fs = require("fs");
const hre = require("hardhat");

async function main() {
  const consumerAddress = "0x9D6E64d6dE2251c1121c1f1f163794EbA5Cf97F1";
  const consumer = await hre.ethers.getContractAt(
    "FTSOConsumer",
    consumerAddress
  );

  // Fetch current snapshot
  const [indices, symbols, prices, decimals, timestamps] =
    await consumer.fetchAllFeeds();

  // Build row objects
  const rows = indices.map((idx, i) => ({
    index:     Number(idx),
    symbol:    symbols[i],
    price:     prices[i].toString(),
    decimals:  Number(decimals[i]),
    timestamp: new Date(Number(timestamps[i]) * 1000).toISOString()
  }));

  // Write JSON file
  fs.writeFileSync(
    "./feeds-snapshot.json",
    JSON.stringify(rows, null, 2),
    "utf-8"
  );
  console.log("Saved current snapshot to feeds-snapshot.json");
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
