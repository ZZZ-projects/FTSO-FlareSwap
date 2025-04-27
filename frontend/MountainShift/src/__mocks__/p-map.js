module.exports = async function pMap(iterable, mapper, options = {}) {
    const concurrency = options.concurrency || Infinity;
    const results = [];
    let index = 0;
    
    // Process tasks with limited concurrency.
    async function worker() {
      while (index < iterable.length) {
        const currentIndex = index++;
        results[currentIndex] = await mapper(iterable[currentIndex]);
      }
    }
    
    // Start workers according to the concurrency limit.
    const workers = Array(Math.min(concurrency, iterable.length))
      .fill(0)
      .map(() => worker());
    
    await Promise.all(workers);
    return results;
  };
  