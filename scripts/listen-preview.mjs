/** Bind directly so another process cannot steal a separately probed port. */
export async function listenPreview(server, preferredPort) {
  if (!Number.isInteger(preferredPort) || preferredPort < 0 || preferredPort > 65535) {
    throw new Error('--port must be an integer between 0 and 65535');
  }
  for (let port = preferredPort; port <= Math.min(preferredPort + 99, 65535); port++) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => { server.off('listening', onListening); reject(error); };
        const onListening = () => { server.off('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port);
      });
      return server.address().port;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`No available preview port starting at ${preferredPort} (tried up to 100 ports)`);
}
