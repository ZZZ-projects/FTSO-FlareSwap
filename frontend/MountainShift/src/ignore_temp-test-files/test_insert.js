require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');



// Ensure your environment variables are set:
// DATABASE_URL - your connection string
// SSL_ROOT_CERT - path to your SSL root certificate file
const connectionString = process.env.DATABASE_URL;
const sslRootCert = process.env.SSL_ROOT_CERT;

if (!connectionString || !sslRootCert) {
  console.error('Please set DATABASE_URL and SSL_ROOT_CERT environment variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString
});





async function testInsert() {
  try {
    const queryText = `
      INSERT INTO shift_history (
        tx_hash,
        usdc_amount,
        chainlink_price,
        uniswap_price,
        coingecko_price,
        coinpaprika_price,
        okx_price,
        coinmarketcap_price,
        consensus_price,
        computed_predicted_arb,
        user_predicted_arb,
        final_arb,
        arb_tx_gas_fee,
        contract_usdc_balance,
        payout_arb_balance,
        contract_address,
        deposit_event,
        txn_link
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id
    `;

    // Dummy values to test the insert.
    const values = [
      '0x' + 'a'.repeat(64),    // tx_hash (66 characters)
      1,                        // usdc_amount (numeric)
      0,                        // chainlink_price (numeric)
      0.5,                      // uniswap_price (numeric)
      0.5,                      // coingecko_price (numeric)
      0.5,                      // coinpaprika_price (numeric)
      0.5,                      // okx_price (numeric)
      0.5,                      // coinmarketcap_price (numeric)
      0.5,                      // consensus_price (numeric)
      2,                        // computed_predicted_arb (numeric)
      2,                        // user_predicted_arb (numeric)
      1.98,                     // final_arb (numeric)
      0,                        // arb_tx_gas_fee (numeric)
      0,                        // contract_usdc_balance (numeric)
      0,                        // payout_arb_balance (numeric)
      '0x' + 'b'.repeat(40),    // contract_address (42 characters)
      { test: 'event' },        // deposit_event (jsonb)
      'N/A'                     // txn_link (text)
    ];
    

    const res = await pool.query(queryText, values);
    console.log('Inserted row id:', res.rows[0].id);
  } catch (err) {
    console.error('Error executing query:', err.stack);
  } finally {
    await pool.end();
  }
}

testInsert();
