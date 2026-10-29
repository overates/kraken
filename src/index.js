import { client, gateway } from './client.js';
import { load } from './loader.js';

for (const event of await load('events')) {
  client.on(event.name, async (payload) => {
    try {
      await event.execute(payload);
    } catch (error) {
      console.error(`Error in ${event.name}`, error);
    }
  });
}

await gateway.connect();
