// lib/gemini.ts

class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing = false;

  async enqueue<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await new Promise(r => setTimeout(r, 2000)); // Delay between requests
      }
    }
    this.isProcessing = false;
  }
}

const reqQueue = new RequestQueue();

export const Agents = {
  _sourceCache: new Map<string, any>(),
  // Agent 2: Source Attribution
  async analyzeSources(percentages: any) {
    const key = JSON.stringify(percentages);
    if (this._sourceCache.has(key)) return this._sourceCache.get(key);
    
    const data = await reqQueue.enqueue(async () => {
      const res = await fetch('/api/analyzeSources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentages })
      });
      return res.json();
    });
    
    this._sourceCache.set(key, data);
    return data;
  },

  _forecastCache: new Map<string, any>(),
  // Agent 3: Hyperlocal Forecasting Explanation
  async explainForecast(trend: string, meteorologyProxy: string) {
    const key = `${trend}-${meteorologyProxy}`;
    if (this._forecastCache.has(key)) return this._forecastCache.get(key);

    const data = await reqQueue.enqueue(async () => {
      const res = await fetch('/api/explainForecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trend, meteorologyProxy })
      });
      return res.json();
    });
    
    this._forecastCache.set(key, data);
    return data;
  },

  _enforceCache: new Map<string, any>(),
  // Agent 4: Enforcement Intelligence
  async justifyEnforcement(sitesData: any[]) {
    const key = JSON.stringify(sitesData);
    if (this._enforceCache.has(key)) return this._enforceCache.get(key);

    const data = await reqQueue.enqueue(async () => {
      const res = await fetch('/api/justifyEnforcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitesData })
      });
      return res.json();
    });
    
    this._enforceCache.set(key, data);
    return data;
  },

  // Agent 5: Citizen Health Advisory (Cached)
  _healthCache: new Map<string, any>(),
  async generateAdvisory(ward: string, group: string, aqiBand: string) {
    const key = `${group}-${aqiBand}`;
    if (this._healthCache.has(key)) return this._healthCache.get(key);

    const data = await reqQueue.enqueue(async () => {
      const res = await fetch('/api/generateAdvisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ward, group, aqiBand })
      });
      return res.json();
    });

    this._healthCache.set(key, data);
    return data;
  }
};
