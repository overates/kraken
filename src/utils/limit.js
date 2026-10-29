export function createLimiter(max, maxQueue) {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= max || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return {
    get busy() {
      return queue.length >= maxQueue;
    },

    run(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
      });
    },
  };
}
