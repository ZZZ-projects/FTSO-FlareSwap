// listFTSOSymbols.js
require("dotenv").config();
const ethers = require("ethers");
const { Buffer } = require("buffer");

// ─── Environment ──────────────────────────────────────────────────────────────
const RPC_URL      = process.env.COSTON2_RPC_URL;
const FTSO_ADDRESS = process.env.FTSO_CONSUMER_ADDRESS;
if (!RPC_URL || !FTSO_ADDRESS) {
  console.error("❗️ Set COSTON2_RPC_URL & FTSO_CONSUMER_ADDRESS in your .env");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Pick the JsonRpcProvider class
const JsonRpcProvider = (
  ethers.providers?.JsonRpcProvider ||
  ethers.JsonRpcProvider
);

// Pick the Interface class
const Interface = (
  ethers.utils?.Interface ||
  ethers.Interface
);

// parseBytes32String: prefer built-in, else manual
const parseBytes32String = (
  ethers.utils?.parseBytes32String ||
  ethers.parseBytes32String ||
  ((b32) => {
    const hex = b32.toString().replace(/^0x/, "");
    const buf = Buffer.from(hex, "hex");
    const idx = buf.indexOf(0);
    return buf.slice(0, idx >= 0 ? idx : buf.length).toString("utf8");
  })
);

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const abi      = require("./artifacts/FTSOConsumer.sol/FTSOConsumer.json").abi;
  const iface    = new Interface(abi);

  // 1) eth_call fetchAllFeeds()
  const data = iface.encodeFunctionData("fetchAllFeeds", []);
  const raw  = await provider.call({ to: FTSO_ADDRESS, data });

  // 2) decode only the symbols array
  const [rawSyms] = iface.decodeFunctionResult("fetchAllFeeds", raw);

  // 3) convert each bytes32 → clean JS string
  const allSyms = rawSyms.map((b32) =>
    parseBytes32String(b32).replace(/\0+$/g, "")
  );

  console.log("Supported symbols on Coston 2:");
  allSyms.forEach((s, i) => {
    console.log(`  [${i}] ${s}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
