import config from '@colyseus/tools';
import { matchMaker } from '@colyseus/core';
import { monitor } from '@colyseus/monitor';
import { playground } from '@colyseus/playground';

/**
 * Import your Room files
 */
import { PlaygroundRoom } from './modules/playground';

export default config({
  initializeGameServer: (gameServer) => {
    /**
     * Define your room handlers:
     */
    gameServer.define('playground', PlaygroundRoom).filterBy(['roomPublicId']);
  },

  initializeExpress: (app) => {
    /**
     * Bind your custom express routes here:
     * Read more: https://expressjs.com/en/starter/basic-routing.html
     */
    app.get('/hello_world', (req, res) => {
      res.send("It's time to kick ass and chew bubblegum!");
    });

    /**
     * Who is inside a room right now. Invisible (ghost) players are left out.
     * Read-only and open to the web app origin (the ids are unguessable ULIDs).
     */
    app.get('/rooms/:roomPublicId/online', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      const listings = await matchMaker.query({ name: 'playground' });
      const players: { id: string; name: string }[] = [];
      for (const listing of listings) {
        if (listing.metadata?.roomPublicId !== req.params.roomPublicId) continue;
        const room = matchMaker.getLocalRoomById(listing.roomId) as any;
        room?.state?.players?.forEach((player: any) => {
          if (!player.ghost) players.push({ id: player.id, name: player.name });
        });
      }
      res.json({ count: players.length, players });
    });

    /**
     * Use @colyseus/playground
     * (It is not recommended to expose this route in a production environment)
     */
    if (process.env.NODE_ENV !== 'production') {
      app.use('/', playground());
    }

    /**
     * Use @colyseus/monitor
     * It is recommended to protect this route with a password
     * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
     */
    app.use('/monitor', monitor());
  },

  beforeListen: () => {
    /**
     * Before before gameServer.listen() is called.
     */
  },
});
