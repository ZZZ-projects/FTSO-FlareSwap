// __mocks__/p-retry.js

module.exports = async function pRetry(fn, options = {}) {
    // For testing, force at least 2 retries (i.e. 3 attempts total),
    // regardless of what options are passed in.
    const retries = 2;
    let attempt = 0;
    let lastError;
  
    while (attempt <= retries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        attempt++;
        // (Optionally, you could add a small delay here if needed)
      }
    }
  
    // If all attempts fail, throw the last encountered error.
    throw lastError;
  };
  