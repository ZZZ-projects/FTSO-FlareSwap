// queryFTSOSelected.js
require("dotenv").config();
const ethers = require("ethers");
const { Buffer } = require("buffer");

// ─── Config ───────────────────────────────────────────────────────────────────
const RPC_URL      = process.env.COSTON2_RPC_URL;
const FTSO_ADDRESS = process.env.FTSO_CONSUMER_ADDRESS;
if (!RPC_URL || !FTSO_ADDRESS) {
  console.error("❗️ Set COSTON2_RPC_URL & FTSO_CONSUMER_ADDRESS in your .env");
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const JsonRpcProvider    = ethers.providers?.JsonRpcProvider   || ethers.JsonRpcProvider;
const Interface           = ethers.utils?.Interface           || ethers.Interface;
const parseBytes32String = ethers.utils?.parseBytes32String  || ethers.parseBytes32String 
  || ((b32) => { // manual fallback
    const hex = b32.toString().slice(2);
    const buf = Buffer.from(hex, "hex");
    const z   = buf.indexOf(0);
    return buf.slice(0, z >= 0 ? z : buf.length).toString("utf8");
  });
const formatUnits        = ethers.utils?.formatUnits         || ethers.formatUnits;

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const wanted = ["testUSDC","testBTC","testARB"];

  // 1) Setup
  const provider = new JsonRpcProvider(RPC_URL);
  const ABI      = require("./artifacts/FTSOConsumer.sol/FTSOConsumer.json").abi;
  const iface    = new Interface(ABI);

  // 2) Single eth_call to fetchAllFeeds()
  const callData = iface.encodeFunctionData("fetchAllFeeds", []);
  const raw      = await provider.call({ to: FTSO_ADDRESS, data: callData });

  // 3) Decode the 3 arrays
  const [rawSyms, rawPrices, rawTss] = iface.decodeFunctionResult("fetchAllFeeds", raw);

  // 4) Build a lookup: symbolString → index
  const idx = {};
  rawSyms.forEach((b32, i) => {
    try {
      const s = parseBytes32String(b32).replace(/\0+$/g, "");
      idx[s]   = i;
    } catch {
      // skip unparsable
    }
  });

  // 5) Print only the wanted ones, converting timestamp via Number()
  for (const sym of wanted) {
    const i = idx[sym];
    if (i == null) {
      console.log(`❓ Symbol "${sym}" not found`);
    } else {
      const price     = formatUnits(rawPrices[i], 18);
      const tsSeconds = Number(rawTss[i]);
      console.log(
        `${sym}: ${price} FPREC  @ ${new Date(tsSeconds * 1000).toISOString()}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
